import { list, put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { buildStoredEvaluationRecord } from "../../lib/evaluation-schema";
import {
  buildEvaluationCompletionPayload,
  notifyEvaluationCompletion,
} from "../../lib/evaluation-completion";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (req.method === "POST") {
      const id = randomUUID();
      const record = buildStoredEvaluationRecord({ id, payload: req.body });

      await put(`evaluations/${id}.json`, JSON.stringify(record), {
        access: "public",
      });

      let callback = { ok: true, skipped: true };
      try {
        const payload = buildEvaluationCompletionPayload({ record, req });
        callback = await notifyEvaluationCompletion(payload);
      } catch (error) {
        console.error(
          "[save-evaluation callback]",
          error instanceof Error ? error.message : error
        );
        callback = {
          ok: false,
          skipped: false,
          error: "Evaluation completion callback failed",
        };
      }

      return res.status(200).json({ id, callback });
    }

    const { id } = req.query;
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "Invalid evaluation id" });
    }

    const { blobs } = await list({ prefix: `evaluations/${id}.json` });

    if (!blobs.length) {
      return res.status(404).json({ error: "Evaluation not found" });
    }

    const response = await fetch(blobs[0].url);
    const evaluation = await response.text();
    return res.status(200).json({ evaluation });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}
