import { list } from "@vercel/blob";
import { requireAdminApiSession } from "../../../../lib/admin-auth";
import { toAdminSummaryRecord } from "../../../../lib/evaluation-schema";

function getIdFromPath(pathname = "") {
  return pathname.replace(/^evaluations\//, "").replace(/\.json$/, "");
}

async function listAllEvaluationBlobs() {
  const all = [];
  let cursor;

  while (true) {
    const response = await list({ prefix: "evaluations/", cursor });
    all.push(...response.blobs);

    if (!response.hasMore || !response.cursor) {
      break;
    }

    cursor = response.cursor;
  }

  return all;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = requireAdminApiSession(req, res);
  if (!session) return;

  try {
    const blobs = await listAllEvaluationBlobs();

    const records = await Promise.all(
      blobs.map(async (blob) => {
        try {
          const response = await fetch(blob.url);
          const text = await response.text();
          const rawRecord = JSON.parse(text);
          const id = getIdFromPath(blob.pathname);
          return toAdminSummaryRecord({ id, rawRecord, blob });
        } catch {
          return null;
        }
      })
    );

    const sortedRecords = records
      .filter(Boolean)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    return res.status(200).json({
      records: sortedRecords,
      count: sortedRecords.length,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list evaluations",
    });
  }
}
