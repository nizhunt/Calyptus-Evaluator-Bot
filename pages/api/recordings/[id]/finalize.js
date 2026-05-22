import { put } from "@vercel/blob";
import { prisma } from "../../../../lib/db";

// Allow up to 5 minutes for large recordings
export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  const { videoChunkUrls, mimeType } = req.body || {};

  if (!Array.isArray(videoChunkUrls) || videoChunkUrls.length === 0) {
    return res.status(400).json({ error: "No video chunk URLs provided" });
  }

  const recording = await prisma.recording.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!recording) {
    return res.status(404).json({ error: "Recording not found" });
  }

  try {
    const ext = mimeType?.includes("mp4") ? "mp4" : "webm";
    const filename = `recording_${id}.${ext}`;

    // Stream chunks through sequentially — avoids buffering the full video in memory
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const url of videoChunkUrls) {
            const chunkRes = await fetch(url);
            if (!chunkRes.ok) {
              throw new Error(
                `Failed to fetch video chunk (${chunkRes.status}): ${url}`,
              );
            }
            const buffer = await chunkRes.arrayBuffer();
            controller.enqueue(new Uint8Array(buffer));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    const blob = await put(filename, stream, {
      access: "public",
      contentType: mimeType || "video/webm",
    });

    await prisma.recording.update({
      where: { id },
      data: { blobUrl: blob.url },
    });

    return res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error("[finalize] failed", {
      recordingId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: "Failed to finalize video" });
  }
}
