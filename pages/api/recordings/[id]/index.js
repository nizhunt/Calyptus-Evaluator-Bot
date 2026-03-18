import { prisma } from "../../../../lib/db";

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "GET") {
    try {
      const recording = await prisma.recording.findUnique({ where: { id } });

      if (!recording) {
        return res.status(404).json({ error: "Recording not found" });
      }

      return res.status(200).json({
        id: recording.id,
        createdAt: recording.createdAt.toISOString(),
        status: recording.status,
        blobUrl: recording.blobUrl,
        transcriptText: recording.transcriptText,
        errorCode: recording.errorCode,
        errorMessage: recording.errorMessage,
      });
    } catch (error) {
      console.error("[recordings/[id] GET]", error);
      return res.status(500).json({ error: "Failed to fetch recording" });
    }
  }

  if (req.method === "PATCH") {
    try {
      const body = req.body || {};
      const allowedStatuses = ["idle", "recording", "video_ready", "transcribing", "transcript_ready", "error"];
      const data = {};

      if (body.status !== undefined) {
        if (!allowedStatuses.includes(body.status)) {
          return res.status(400).json({ error: "Invalid status value" });
        }
        data.status = body.status;
      }
      if (typeof body.blobUrl === "string") data.blobUrl = body.blobUrl;
      if (typeof body.blobPathname === "string") data.blobPathname = body.blobPathname;
      if (typeof body.transcriptText === "string") {
        if (body.transcriptText.length > 500000) {
          console.warn("[recordings/[id] PATCH] transcriptText truncated from %d chars to 500000 for recording %s", body.transcriptText.length, id);
        }
        data.transcriptText = body.transcriptText.slice(0, 500000);
      }
      if (typeof body.errorCode === "string") data.errorCode = body.errorCode.slice(0, 100);
      if (typeof body.errorMessage === "string") data.errorMessage = body.errorMessage.slice(0, 1000);

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "No valid fields provided" });
      }

      const recording = await prisma.recording.update({
        where: { id },
        data,
      });

      return res.status(200).json({
        id: recording.id,
        status: recording.status,
      });
    } catch (error) {
      console.error("[recordings/[id] PATCH]", error);
      return res.status(500).json({ error: "Failed to update recording" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
