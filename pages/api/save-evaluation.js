import { list, put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { buildStoredEvaluationRecord } from "../../lib/evaluation-schema";

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const id = randomUUID();
      const record = buildStoredEvaluationRecord({ id, payload: req.body });

      await put(`evaluations/${id}.json`, JSON.stringify(record), {
        access: "public",
      });

      return res.status(200).json({ id });
    }

    if (req.method === "GET") {
      const { id } = req.query;
      const { blobs } = await list({ prefix: `evaluations/${id}.json` });

      if (blobs.length === 0) {
        return res.status(404).json({ error: "Evaluation not found" });
      }

      const response = await fetch(blobs[0].url);
      const evaluation = await response.text();
      return res.status(200).json({ evaluation });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}
