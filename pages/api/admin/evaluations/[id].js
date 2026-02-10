import { del, list } from "@vercel/blob";
import { requireAdminApiSession } from "../../../../lib/admin-auth";
import { toAdminSummaryRecord } from "../../../../lib/evaluation-schema";

async function getEvaluationBlob(id) {
  const { blobs } = await list({ prefix: `evaluations/${id}.json` });
  if (!blobs.length) return null;
  return blobs[0];
}

export default async function handler(req, res) {
  const session = requireAdminApiSession(req, res);
  if (!session) return;

  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: "Invalid evaluation id" });
  }

  try {
    const blob = await getEvaluationBlob(id);

    if (!blob) {
      return res.status(404).json({ error: "Evaluation not found" });
    }

    if (req.method === "DELETE") {
      await del(blob.url);
      return res.status(200).json({ ok: true });
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const response = await fetch(blob.url);
    const text = await response.text();
    const rawRecord = JSON.parse(text);
    const summary = toAdminSummaryRecord({ id, rawRecord, blob });

    return res.status(200).json({
      id,
      summary,
      record: rawRecord,
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch evaluation",
    });
  }
}
