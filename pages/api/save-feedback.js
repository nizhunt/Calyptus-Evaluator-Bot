import { list, put } from "@vercel/blob";
import { updateRecordWithFeedback } from "../../lib/evaluation-schema";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { evaluationId, rating, comment } = req.body || {};

  if (!evaluationId || typeof evaluationId !== "string") {
    return res.status(400).json({ error: "evaluationId is required" });
  }

  try {
    const { blobs } = await list({ prefix: `evaluations/${evaluationId}.json` });

    if (!blobs.length) {
      return res.status(404).json({ error: "Evaluation not found" });
    }

    const response = await fetch(blobs[0].url);
    const text = await response.text();
    const raw = JSON.parse(text);

    const updatedRecord = updateRecordWithFeedback(raw, {
      stars: rating,
      comment,
    });

    await put(`evaluations/${evaluationId}.json`, JSON.stringify(updatedRecord), {
      access: "public",
      allowOverwrite: true,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to save feedback",
    });
  }
}
