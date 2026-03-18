import { prisma } from "../../../lib/db";

const ACTIVE_STATUSES = [
  "idle",
  "recording",
  "uploading",
  "video_ready",
  "transcribing",
  "transcript_ready",
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { clientSessionId } = req.body || {};

    // Cleanup orphan recordings older than 1 hour stuck in idle/uploading
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.recording.updateMany({
      where: {
        status: { in: ["idle", "uploading"] },
        createdAt: { lt: oneHourAgo },
      },
      data: {
        status: "error",
        errorCode: "ORPHANED",
      },
    });

    // If clientSessionId provided, check for an existing active recording
    if (clientSessionId) {
      const existing = await prisma.recording.findFirst({
        where: {
          clientSessionId,
          status: { in: ACTIVE_STATUSES },
        },
      });

      if (existing) {
        return res.status(200).json({ recordingId: existing.id });
      }
    }

    const recording = await prisma.recording.create({
      data: {
        status: "idle",
        ...(clientSessionId ? { clientSessionId } : {}),
      },
    });

    return res.status(200).json({ recordingId: recording.id });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      const recordingId = createEphemeralRecordingId();
      console.warn("[recordings/init] Database unavailable. Using ephemeral recording ID.", {
        recordingId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(200).json({
        recordingId,
        storage: "ephemeral",
      });
    }

    console.error("[recordings/init] Failed to create recording:", error);
    return res.status(500).json({ error: "Failed to initialize recording" });
  }
}

function isDatabaseUnavailableError(error) {
  if (!error) return false;
  const code = typeof error === "object" && "code" in error ? error.code : undefined;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    code === "P5010" ||
    message.includes("cannot fetch data from service") ||
    message.includes("can't reach database server")
  );
}

function createEphemeralRecordingId() {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
