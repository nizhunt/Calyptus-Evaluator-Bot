export const NIL_VALUE = "[nil]";

function textOrNil(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return NIL_VALUE;
}

function toNumberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cleanJsonFence(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export function safeJsonParse(value) {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(cleanJsonFence(value));
  } catch {
    return null;
  }
}

export function unwrapStoredEvaluation(rawRecord) {
  if (!rawRecord || typeof rawRecord !== "object") {
    return {
      evaluation: rawRecord,
      metadata: {},
      root: {},
    };
  }

  const root = rawRecord;
  const nested = root?.data && typeof root.data === "object" ? root.data : null;

  const evaluation = nested?.evaluation ?? root.evaluation ?? root;
  const metadata = nested?.metadata ?? root.metadata ?? {};

  return { evaluation, metadata, root };
}

export function parseEvaluationObject(rawEvaluation) {
  let parsed = rawEvaluation;

  if (typeof parsed === "string") {
    parsed = safeJsonParse(parsed) ?? parsed;
  }

  if (typeof parsed === "string") {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  if (parsed.evaluation && typeof parsed.evaluation === "object") {
    return parsed.evaluation;
  }

  return parsed;
}

function normalizeSubmittedFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .filter((file) => file && typeof file === "object")
    .map((file) => ({
      name: textOrNil(file.name),
      url: textOrNil(file.url),
      type: textOrNil(file.type),
    }));
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function toSerializableDate(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return NIL_VALUE;
}

export function buildStoredEvaluationRecord({ id, payload }) {
  const base = payload?.data && typeof payload.data === "object" ? payload.data : payload || {};
  const metadata = base?.metadata && typeof base.metadata === "object" ? base.metadata : {};

  const now = new Date().toISOString();

  const companyName = textOrNil(
    firstDefined(metadata.companyName, metadata.company, metadata.employerName)
  );

  const testCreatorName = textOrNil(
    firstDefined(metadata?.testCreator?.name, metadata.creatorName)
  );

  const testCreatorEmail = textOrNil(
    firstDefined(metadata?.testCreator?.email, metadata.creatorEmail, metadata.emailId)
  );

  const candidateName = textOrNil(firstDefined(metadata?.candidate?.name));
  const candidateEmail = textOrNil(firstDefined(metadata?.candidate?.email));

  const stars = toNumberOrNull(firstDefined(metadata?.feedback?.stars, metadata.rating));
  const comment = textOrNil(firstDefined(metadata?.feedback?.comment, metadata.comment));
  const feedbackUpdatedAt = textOrNil(firstDefined(metadata?.feedback?.updatedAt));

  return {
    schemaVersion: 2,
    id,
    createdAt: now,
    updatedAt: now,
    evaluation: base?.evaluation ?? NIL_VALUE,
    metadata: {
      companyName,
      testCreator: {
        name: testCreatorName,
        email: testCreatorEmail,
      },
      candidate: {
        name: candidateName,
        email: candidateEmail,
      },
      feedback: {
        stars,
        comment,
        updatedAt: feedbackUpdatedAt,
      },
      recordingUrl: textOrNil(firstDefined(metadata.recordingUrl)),
      recorderId: textOrNil(firstDefined(metadata.recorderId)),
      submittedFiles: normalizeSubmittedFiles(metadata.submittedFiles),
      assessmentQuestion: textOrNil(firstDefined(metadata.assessmentQuestion)),
      customInstructions: textOrNil(firstDefined(metadata.customInstructions)),
    },
  };
}

export function toAdminSummaryRecord({ id, rawRecord, blob }) {
  const { evaluation, metadata, root } = unwrapStoredEvaluation(rawRecord);
  const parsedEvaluation = parseEvaluationObject(evaluation);

  const overallScore =
    toNumberOrNull(parsedEvaluation?.overallScore) ??
    toNumberOrNull(parsedEvaluation?.overall?.score);

  const feedbackStars = toNumberOrNull(metadata?.feedback?.stars);
  const companyName = textOrNil(
    firstDefined(metadata?.companyName, metadata?.company, metadata?.employerName)
  );
  const testCreatorName = textOrNil(
    firstDefined(metadata?.testCreator?.name, metadata?.creatorName)
  );
  const testCreatorEmail = textOrNil(
    firstDefined(
      metadata?.testCreator?.email,
      metadata?.creatorEmail,
      metadata?.emailId
    )
  );
  const candidateName = textOrNil(
    firstDefined(metadata?.candidate?.name, metadata?.candidateName)
  );
  const candidateEmail = textOrNil(
    firstDefined(metadata?.candidate?.email, metadata?.candidateEmail)
  );
  const feedbackComment = textOrNil(
    firstDefined(metadata?.feedback?.comment, metadata?.comment)
  );

  return {
    id: root?.id || id,
    schemaVersion: root?.schemaVersion || 1,
    createdAt: toSerializableDate(root?.createdAt || blob?.uploadedAt),
    updatedAt: toSerializableDate(root?.updatedAt || blob?.uploadedAt),
    companyName,
    testCreatorName,
    testCreatorEmail,
    candidateName,
    candidateEmail,
    feedbackComment,
    feedbackStars: feedbackStars ?? NIL_VALUE,
    overallScore: overallScore ?? NIL_VALUE,
    evaluationPath: `/admin/evaluations/${root?.id || id}`,
    publicEvaluationPath: `/evaluation/${root?.id || id}`,
  };
}

export function updateRecordWithFeedback(rawRecord, { stars, comment }) {
  const source =
    rawRecord && typeof rawRecord === "object"
      ? { ...rawRecord }
      : { evaluation: rawRecord };
  const rootMetadata =
    source.metadata && typeof source.metadata === "object" ? { ...source.metadata } : {};
  const nestedData =
    source.data && typeof source.data === "object" ? { ...source.data } : null;
  const nestedMetadata =
    nestedData?.metadata && typeof nestedData.metadata === "object"
      ? { ...nestedData.metadata }
      : {};

  const metadataSource =
    Object.keys(rootMetadata).length > 0 ? rootMetadata : nestedMetadata;
  const existingFeedback =
    metadataSource.feedback && typeof metadataSource.feedback === "object"
      ? { ...metadataSource.feedback }
      : {};

  const nextStars = toNumberOrNull(stars);
  const nextComment = textOrNil(comment);

  const updatedMetadata = {
    ...metadataSource,
    feedback: {
      ...existingFeedback,
      stars: nextStars,
      comment: nextComment,
      updatedAt: new Date().toISOString(),
    },
  };

  source.metadata = updatedMetadata;
  if (nestedData) {
    source.data = {
      ...nestedData,
      metadata: updatedMetadata,
    };
  }

  source.updatedAt = new Date().toISOString();
  source.schemaVersion = source.schemaVersion || 2;

  return source;
}
