import { list } from "@vercel/blob";
import { requireAdminApiSession } from "../../../../lib/admin-auth";
import { toAdminSummaryRecord } from "../../../../lib/evaluation-schema";

function getIdFromPath(pathname = "") {
  return pathname.replace(/^evaluations\//, "").replace(/\.json$/, "");
}

const DEFAULT_LIMIT = 50;
const CONCURRENCY_LIMIT = 5;

async function listEvaluationBlobs({ limit = DEFAULT_LIMIT, cursor } = {}) {
  const blobs = [];
  let nextCursor = cursor;

  while (blobs.length < limit) {
    const response = await list({
      prefix: "evaluations/",
      cursor: nextCursor,
      limit: Math.min(limit - blobs.length, 1000),
    });

    blobs.push(...response.blobs);

    if (!response.hasMore || !response.cursor) {
      nextCursor = undefined;
      break;
    }

    nextCursor = response.cursor;
  }

  // If we collected more than requested (unlikely but defensive), trim and
  // keep the cursor so the client can pick up where we left off.
  if (blobs.length > limit) {
    blobs.length = limit;
    // nextCursor stays as-is so the next page can continue
  }

  return { blobs, nextCursor };
}

async function fetchBlobRecords(blobs) {
  const results = [];

  for (let i = 0; i < blobs.length; i += CONCURRENCY_LIMIT) {
    const batch = blobs.slice(i, i + CONCURRENCY_LIMIT);

    const batchResults = await Promise.all(
      batch.map(async (blob) => {
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

    results.push(...batchResults);
  }

  return results.filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireAdminApiSession(req, res)) return;

  try {
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const cursor = req.query.cursor || undefined;

    const { blobs, nextCursor } = await listEvaluationBlobs({ limit, cursor });

    const records = await fetchBlobRecords(blobs);

    const sortedRecords = records
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    return res.status(200).json({
      records: sortedRecords,
      nextCursor: nextCursor || null,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list evaluations",
    });
  }
}
