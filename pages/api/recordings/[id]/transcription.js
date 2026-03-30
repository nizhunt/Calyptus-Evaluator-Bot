import { list } from "@vercel/blob";
import OpenAI from "openai";
import { prisma } from "../../../../lib/db";

const OPENAI_TRANSCRIPTION_MAX_BYTES = 25 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;

  let blobUrl;
  let audioChunkUrls = [];
  let backupAudioUrl;

  try {
    const body = req.body || {};
    if (typeof body.blobUrl === "string") blobUrl = body.blobUrl;
    if (Array.isArray(body.audioChunkUrls)) {
      audioChunkUrls = body.audioChunkUrls.filter(
        (v) => typeof v === "string" && v.length > 0
      );
    }
    if (typeof body.backupAudioUrl === "string" && body.backupAudioUrl.length > 0) {
      backupAudioUrl = body.backupAudioUrl;
    }
  } catch {
    // body may be empty
  }

  try {
    // Priority 1: audioChunkUrls[] from client (new default path)
    // Priority 2: discover chunks from blob storage
    // Priority 3: backupAudioUrl (legacy)
    // Priority 4: blobUrl (video file, last resort)

    let resolvedChunkUrls = audioChunkUrls;

    if (resolvedChunkUrls.length === 0) {
      // Priority 2: discover from blob storage
      resolvedChunkUrls = await discoverAudioChunkUrls(id);
    }

    // Resolve backup audio URL (only used if no chunks available)
    if (!backupAudioUrl) {
      backupAudioUrl = extractPreferredBackupAudioUrl(resolvedChunkUrls);
    }

    // Filter out the _audio_full backup from chunk list so it's not double-transcribed
    if (backupAudioUrl) {
      resolvedChunkUrls = resolvedChunkUrls.filter((u) => u !== backupAudioUrl);
    }

    const recording = await prisma.recording.findUnique({ where: { id } });
    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const resolvedBlobUrl = blobUrl || recording.blobUrl || undefined;
    const hasChunks = resolvedChunkUrls.length > 0;

    if (!resolvedBlobUrl && !hasChunks && !backupAudioUrl) {
      return res.status(400).json({
        error: "Recording has no transcribable input (missing blobUrl/audioChunkUrls)",
      });
    }

    // Only check video size if we have NO audio chunks and NO backup audio
    if (resolvedBlobUrl && !hasChunks && !backupAudioUrl) {
      const contentLength = await probeContentLength(resolvedBlobUrl);
      if (contentLength !== null && contentLength > OPENAI_TRANSCRIPTION_MAX_BYTES) {
        await prisma.recording.update({
          where: { id },
          data: {
            status: "error",
            errorCode: "TRANSCRIPTION_TOO_LARGE",
            errorMessage:
              "Recording exceeds transcription size limit and no audio chunks were available.",
          },
        });
        return res.status(422).json({
          error: "Recording too large for direct transcription without audio chunks",
          code: "TRANSCRIPTION_TOO_LARGE",
        });
      }
    }

    if (recording.status === "transcribing") {
      return res
        .status(409)
        .json({ error: "Transcription already in progress", status: "transcribing" });
    }

    if (recording.status === "transcript_ready" && recording.transcriptText) {
      return res.status(200).json({ success: true, status: "transcript_ready" });
    }

    // Validate blobUrl is accessible before proceeding
    if (resolvedBlobUrl) {
      try {
        const headRes = await fetch(resolvedBlobUrl, { method: "HEAD" });
        if (!headRes.ok) {
          return res.status(422).json({
            error: `Blob URL is not accessible (HTTP ${headRes.status})`,
            code: "BLOB_UNREACHABLE",
          });
        }
      } catch (err) {
        return res.status(422).json({
          error: "Blob URL is not accessible",
          code: "BLOB_UNREACHABLE",
        });
      }
    }

    await prisma.recording.update({
      where: { id },
      data: {
        status: "transcribing",
        blobUrl: resolvedBlobUrl,
        errorCode: null,
        errorMessage: null,
      },
    });

    enqueueTranscription(id, {
      blobUrl: resolvedBlobUrl,
      audioChunkUrls: resolvedChunkUrls,
      backupAudioUrl,
    });

    return res.status(202).json({ success: true, status: "transcribing" });
  } catch (error) {
    console.error("[transcription] request_failed", { recordingId: id, error });
    return res.status(500).json({ error: "Failed to start transcription" });
  }
}

// ---------------------------------------------------------------------------
// Background transcription job
// ---------------------------------------------------------------------------

function enqueueTranscription(recordingId, input) {
  (async () => {
    try {
      const transcriptText = await transcribeRecording(input);

      if (!transcriptText || transcriptText.trim().length < 10) {
        console.warn("[transcription] empty_or_short_transcript", {
          recordingId,
          length: transcriptText ? transcriptText.trim().length : 0,
        });
        await prisma.recording.update({
          where: { id: recordingId },
          data: {
            status: "error",
            errorCode: "TRANSCRIPT_EMPTY",
            errorMessage:
              "Transcription returned empty or insufficient text.",
          },
        });
        return;
      }

      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          status: "transcript_ready",
          transcriptText,
          errorCode: null,
          errorMessage: null,
        },
      });
    } catch (error) {
      console.error("[transcription] job_failed", { recordingId, error });
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          status: "error",
          errorCode: getErrorCode(error),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  })();
}

async function transcribeRecording(input) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  if (input.audioChunkUrls.length > 0) {
    return transcribeUrls(openai, input.audioChunkUrls);
  }
  if (input.backupAudioUrl) {
    return transcribeUrls(openai, [input.backupAudioUrl]);
  }
  if (!input.blobUrl) {
    throw new Error("No blob URL provided for transcription");
  }
  return transcribeUrls(openai, [input.blobUrl]);
}

const TRANSCRIPTION_CONCURRENCY = 3;

async function transcribeUrls(openai, urls) {
  const total = urls.length;
  const results = new Array(total).fill(null);
  let successCount = 0;
  let firstError = null;

  async function transcribeOne(i) {
    try {
      const response = await fetch(urls[i]);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio ${i + 1}/${total}: ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.byteLength > OPENAI_TRANSCRIPTION_MAX_BYTES) {
        throw new Error(`Audio ${i + 1} exceeds transcription upload limit.`);
      }

      const { ext, mime } = resolveAudioFormat(contentType, urls[i]);
      const file = new File([Uint8Array.from(buffer)], `audio-${String(i + 1).padStart(4, "0")}.${ext}`, { type: mime });
      const text = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: "en",
        response_format: "text",
      });

      const normalized = text.replace(/\s+/g, " ").trim();
      successCount++;
      if (normalized) results[i] = normalized;
    } catch (error) {
      if (!firstError) firstError = error;
      console.warn("[transcription] audio_chunk_failed", { chunkIndex: i, error });
    }
  }

  for (let batch = 0; batch < total; batch += TRANSCRIPTION_CONCURRENCY) {
    const batchEnd = Math.min(batch + TRANSCRIPTION_CONCURRENCY, total);
    const promises = [];
    for (let i = batch; i < batchEnd; i++) {
      promises.push(transcribeOne(i));
    }
    await Promise.all(promises);
  }

  if (successCount === 0 && firstError) {
    throw firstError;
  }

  return results.filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractPreferredBackupAudioUrl(urls) {
  for (const url of urls) {
    try {
      if (new URL(url).pathname.toLowerCase().includes("_audio_full.")) {
        return url;
      }
    } catch {
      if (url.toLowerCase().includes("_audio_full.")) return url;
    }
  }
  return undefined;
}

async function discoverAudioChunkUrls(recordingId) {
  const prefix = `recording_${recordingId}_audio_`;
  try {
    const urls = [];
    let cursor;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      for (const blob of page.blobs) {
        if (blob.url) urls.push(blob.url);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    return sortChunkUrls(urls);
  } catch {
    return [];
  }
}

function sortChunkUrls(urls) {
  const CHUNK_INDEX_RE = /_chunk_(\d+)\./;
  return urls.sort((a, b) => {
    const matchA = a.match(CHUNK_INDEX_RE);
    const matchB = b.match(CHUNK_INDEX_RE);
    if (matchA && matchB) {
      return Number(matchA[1]) - Number(matchB[1]);
    }
    // Fall back to alphabetical if pattern doesn't match
    return a.localeCompare(b);
  });
}

async function probeContentLength(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) return null;
    const header = response.headers.get("content-length");
    if (!header) return null;
    const parsed = Number.parseInt(header, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const EXT_TO_MIME = {
  webm: "audio/webm",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
};

function resolveAudioFormat(contentType, url) {
  const ct = contentType || "";
  if (ct.includes("webm")) return { ext: "webm", mime: "audio/webm" };
  if (ct.includes("mp4")) return { ext: "mp4", mime: "audio/mp4" };
  if (ct.includes("mpeg")) return { ext: "mp3", mime: "audio/mpeg" };
  if (ct.includes("wav")) return { ext: "wav", mime: "audio/wav" };
  if (ct.includes("ogg")) return { ext: "ogg", mime: "audio/ogg" };
  if (ct.includes("flac")) return { ext: "flac", mime: "audio/flac" };
  // Blob storage often returns application/octet-stream — fall back to URL extension
  if (url) {
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      const match = pathname.match(/\.(webm|mp4|mp3|wav|ogg|flac|m4a)(?:\?|$)/);
      if (match) return { ext: match[1], mime: EXT_TO_MIME[match[1]] };
    } catch {}
  }
  // Our recorder always produces webm audio
  return { ext: "webm", mime: "audio/webm" };
}

function getErrorCode(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (
    message.includes("upload size limit") ||
    message.includes("too large") ||
    message.includes("exceeds")
  ) {
    return "TRANSCRIPTION_TOO_LARGE";
  }
  return "TRANSCRIPTION_FAILED";
}
