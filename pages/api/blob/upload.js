import { handleUpload } from "@vercel/blob/client";
import { prisma } from "../../../lib/db";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;
  if (!body) {
    return res.status(400).json({ error: "Invalid upload payload" });
  }

  try {
    // Construct a Web API Request for handleUpload's signature verification.
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || "localhost:3000";
    const webRequest = new Request(`${protocol}://${host}${req.url}`, {
      method: req.method,
      headers: new Headers(
        Object.entries(req.headers).reduce((acc, [key, value]) => {
          if (typeof value === "string") acc[key] = value;
          return acc;
        }, {})
      ),
    });

    const jsonResponse = await handleUpload({
      body,
      request: webRequest,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        return {
          allowedContentTypes: [
            "video/webm",
            "video/mp4",
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/mp4;codecs=avc1,mp4a.40.2",
            "video/mp4;codecs=h264,aac",
            "audio/webm",
            "audio/webm;codecs=opus",
            "audio/mp4",
            "audio/mp4;codecs=aac",
            "audio/mpeg",
            "audio/wav",
          ],
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: clientPayload || undefined,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const parsed = safeParseJson(tokenPayload);
        const recordingId = parsed?.recordingId;
        const isAudioChunk = blob.pathname.includes("_audio_");

        if (recordingId && !isAudioChunk) {
          try {
            await prisma.recording.update({
              where: { id: recordingId },
              data: {
                status: "video_ready",
                blobUrl: blob.url,
                blobPathname: blob.pathname,
              },
            });
          } catch (error) {
            console.error("[blob] recording_update_failed", {
              recordingId,
              pathname: blob.pathname,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error("[blob] request_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(400).json({ error: "Upload failed" });
  }
}

function safeParseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
