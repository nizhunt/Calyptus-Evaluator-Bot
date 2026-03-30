import {
  NIL_VALUE,
  parseEvaluationObject,
  unwrapStoredEvaluation,
} from "./evaluation-schema";

function trimTrailingSlash(value) {
  if (!value || typeof value !== "string") return "";
  return value.replace(/\/+$/, "");
}

function resolveBaseUrl(req) {
  const configuredBaseUrl =
    process.env.VERCEL_ENV === "production"
      ? process.env.BASE_URL_PROD
      : process.env.BASE_URL_LOCAL;

  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl);
  }

  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || "";
  return host ? `${protocol}://${host}` : "";
}

function nilToNull(value) {
  if (value === NIL_VALUE || value === undefined || value === null || value === "") {
    return null;
  }
  return value;
}

function normalizePerson(person) {
  return {
    name: nilToNull(person?.name),
    email: nilToNull(person?.email),
  };
}

function normalizeSubmittedFiles(files) {
  if (!Array.isArray(files)) return [];

  return files.map((file) => ({
    name: nilToNull(file?.name),
    url: nilToNull(file?.url),
    type: nilToNull(file?.type),
  }));
}

function normalizeMetadata(metadata) {
  const recordingDurationSeconds = Number(metadata?.recordingDurationSeconds);

  return {
    sourceTestId: nilToNull(metadata?.sourceTestId),
    is_test: Boolean(metadata?.is_test),
    companyName: nilToNull(metadata?.companyName),
    testCreator: normalizePerson(metadata?.testCreator),
    candidate: normalizePerson(metadata?.candidate),
    assessmentQuestion: nilToNull(metadata?.assessmentQuestion),
    customInstructions: nilToNull(metadata?.customInstructions),
    recordingUrl: nilToNull(metadata?.recordingUrl),
    recordingDurationSeconds: Number.isFinite(recordingDurationSeconds)
      ? recordingDurationSeconds
      : null,
    recorderId: nilToNull(metadata?.recorderId),
    submittedFiles: normalizeSubmittedFiles(metadata?.submittedFiles),
  };
}

export function buildEvaluationCompletionPayload({ record, req }) {
  const { evaluation, metadata, root } = unwrapStoredEvaluation(record);
  const parsedEvaluation = parseEvaluationObject(evaluation) ?? evaluation;
  const normalizedMetadata = normalizeMetadata(metadata);
  const baseUrl = resolveBaseUrl(req);
  const evaluationId = root?.id || null;

  return {
    sourceTestId: normalizedMetadata.sourceTestId,
    is_test: normalizedMetadata.is_test,
    evaluationId,
    evaluationUrl:
      evaluationId && baseUrl ? `${baseUrl}/evaluation/${evaluationId}` : null,
    timestamp: root?.updatedAt || root?.createdAt || new Date().toISOString(),
    evaluation: parsedEvaluation,
    metadata: normalizedMetadata,
  };
}

export async function notifyEvaluationCompletion(payload) {
  const callbackUrl = payload?.is_test
    ? "https://dev.api.calyptus.co/api/ai-fluency-tests/finish-test"
    : "https://api.calyptus.co/api/ai-fluency-tests/finish-test";

  const headers = {
    "Content-Type": "application/json",
  };

  if (process.env.EVALUATION_COMPLETE_API_KEY) {
    headers.Authorization = process.env.EVALUATION_COMPLETE_API_KEY;
  }

  const response = await fetch(callbackUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Callback to ${callbackUrl} failed with status ${response.status}: ${body}`);
  }

  return {
    ok: true,
    skipped: false,
    status: response.status,
  };
}
