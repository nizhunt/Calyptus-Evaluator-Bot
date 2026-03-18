import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import formidable from "formidable";
import OpenAI from "openai";
import { put } from "@vercel/blob";
import { safeJsonParse } from "../../lib/evaluation-schema";

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeField(value, fallback = "") {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

function normalizeFiles(fileValue) {
  if (!fileValue) return [];
  return Array.isArray(fileValue) ? fileValue : [fileValue];
}

async function parseMultipartForm(req) {
  const form = formidable({ multiples: true, keepExtensions: true });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

async function readPromptTemplate() {
  const promptPath = path.join(process.cwd(), "data", "evaluation_prompt.md");
  return fs.readFile(promptPath, "utf8");
}

function sanitizeCustomInstructions(raw) {
  if (!raw || typeof raw !== "string") return "None";
  const trimmed = raw.trim();
  if (!trimmed) return "None";

  // Strip patterns commonly used in prompt injection
  const cleaned = trimmed
    .replace(/(ignore|disregard|forget|override)\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi, "[removed]")
    .replace(/you\s+are\s+now\b/gi, "[removed]")
    .replace(/new\s+instructions?:/gi, "[removed]")
    .replace(/system\s*:/gi, "[removed]");

  // Cap length to prevent context stuffing
  const maxLen = 2000;
  return cleaned.length > maxLen
    ? cleaned.slice(0, maxLen) + "... (truncated)"
    : cleaned;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function auditScores(evaluation) {
  const result = JSON.parse(JSON.stringify(evaluation));

  const sections = [
    { key: "helperBotConversation", weight: 0.3 },
    { key: "outputQuality", weight: 0.5 },
    { key: "transcriptionQuality", weight: 0.2 },
  ];

  for (const { key } of sections) {
    const section = result[key];
    if (!section?.subScores) {
      section.score = 0;
      continue;
    }

    // Clamp each sub-score to 0-2
    for (const subKey of Object.keys(section.subScores)) {
      section.subScores[subKey] = clamp(
        Math.round(section.subScores[subKey] * 10) / 10,
        0,
        2
      );
    }

    // Section score = sum of sub-scores, clamped to 0-10
    const sum = Object.values(section.subScores).reduce((a, b) => a + b, 0);
    section.score = clamp(Math.round(sum * 10) / 10, 0, 10);
  }

  // Compute a mechanical reference score for divergence check
  let totalWeight = 0;
  const effectiveWeights = sections.map(({ key, weight }) => {
    const section = result[key];
    const hasData = section.score > 0 || section?.comments?.length > 30;
    const w = hasData ? weight : 0;
    totalWeight += w;
    return w;
  });
  const normalizedWeights = effectiveWeights.map((w) =>
    totalWeight > 0 ? w / totalWeight : 0
  );
  let mechanicalScore = 0;
  for (let i = 0; i < sections.length; i++) {
    mechanicalScore += (result[sections[i].key]?.score || 0) * normalizedWeights[i];
  }
  mechanicalScore = Math.round(mechanicalScore * 10) / 10;

  // Use the LLM's holistic overallScore, clamped to 0-10
  const llmOverall = clamp(
    Math.round((result.overallScore ?? mechanicalScore) * 10) / 10,
    0,
    10
  );

  // Flag divergence but trust the LLM's holistic judgment
  const divergence = Math.abs(llmOverall - mechanicalScore);
  if (divergence > 1.5) {
    console.warn(
      `[auditScores] overallScore divergence: LLM=${llmOverall}, mechanical=${mechanicalScore}, delta=${divergence.toFixed(1)}`
    );
  }

  result.overallScore = llmOverall;
  result._mechanicalScore = mechanicalScore;

  return result;
}

function buildPrompt(template, data) {
  return template
    .replace("[INSERT_CUSTOM_INSTRUCTIONS]", sanitizeCustomInstructions(data.customInstructions))
    .replace("[INSERT_ASSESSMENT_QUESTION]", data.assessmentQuestion || "Not provided")
    .replace("[INSERT_CONVERSATION_MARKDOWN]", data.conversationContent || "No conversation provided")
    .replace("[INSERT_TRANSCRIPT_CONTENT]", data.inhouseTranscript || "No transcript provided")
    .replace("[INSERT_SCREENSHOT_DESCRIPTIONS_OR_LINKS]", data.screenshotSummary || "No screenshots submitted")
    .replace("[INSERT_OUTPUT_FILE_DESCRIPTIONS_OR_CONTENT]", data.outputSummary || "No output files submitted");
}

async function maybeUploadFile(file) {
  if (!file?.filepath) return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return null;
  }

  const fileBuffer = await fs.readFile(file.filepath);
  const ext = path.extname(file.originalFilename || "");
  const safeName = `${randomUUID()}${ext}`;
  const blob = await put(`submissions/${safeName}`, fileBuffer, {
    access: "public",
    contentType: file.mimetype || undefined,
  });

  return {
    name: file.originalFilename || safeName,
    url: blob.url,
    type: file.mimetype || "application/octet-stream",
  };
}

async function appendLog(prompt, output, errorMessage = null) {
  try {
    const logPath = path.join(process.cwd(), "logs", "evaluation_logs.md");
    const timestamp = new Date().toISOString();
    const errorSection = errorMessage ? `\n\n### Error:\n\`\`\`\n${errorMessage}\n\`\`\`\n` : "";
    const logEntry = `\n\n## Evaluation Log - ${timestamp}\n\n### Input:\n\`\`\`\n${prompt}\n\`\`\`\n\n### Output:\n\`\`\`json\n${output}\n\`\`\`${errorSection}`;
    await fs.appendFile(logPath, logEntry, "utf8");
  } catch {
    // Logging failures should never fail the request.
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "Server misconfiguration: OPENAI_API_KEY is missing",
    });
  }

  let allTempFiles = [];
  try {
    const { fields, files } = await parseMultipartForm(req);

    const assessmentQuestion = normalizeField(fields.assessmentQuestion).slice(0, 10000);
    const conversationContent = normalizeField(fields.conversationContent).slice(0, 100000);
    const inhouseTranscript = normalizeField(fields.inhouseTranscript).slice(0, 200000);
    const recordingUrl = normalizeField(fields.recordingUrl);
    const recordingDurationSecondsRaw = normalizeField(fields.recordingDurationSeconds);
    const recorderId = normalizeField(fields.recorderId);
    const customInstructions = normalizeField(fields.customInstructions);
    const candidateName = normalizeField(fields.candidateName);
    const candidateEmail = normalizeField(fields.candidateEmail);

    const screenshotFiles = normalizeFiles(files.screenshots);
    const outputFiles = normalizeFiles(files.outputFile);
    allTempFiles = [...screenshotFiles, ...outputFiles];
    const recordingDurationSeconds = Number(recordingDurationSecondsRaw);
    const normalizedRecordingDurationSeconds =
      Number.isFinite(recordingDurationSeconds) && recordingDurationSeconds > 0
        ? recordingDurationSeconds
        : 0;

    // Upload all files to Blob BEFORE the LLM call so URLs are available
    const uploadResults = await Promise.all(
      [...screenshotFiles, ...outputFiles].map((file) =>
        maybeUploadFile(file).catch(() => null)
      )
    );
    const submittedFiles = uploadResults.filter(Boolean);

    const uploadedScreenshots = submittedFiles.filter((f) =>
      f.type.startsWith("image/")
    );

    const screenshotSummary =
      uploadedScreenshots.length > 0
        ? `${uploadedScreenshots.length} screenshot(s) are attached as images below. Analyze each visually.\n` +
          uploadedScreenshots.map((f, idx) => `${idx + 1}. ${f.name}`).join("\n")
        : "";

    // Read text-based output file contents from formidable temp files
    const outputParts = [];
    for (const file of outputFiles) {
      if (!file?.filepath) continue;
      const mime = file.mimetype || "";
      const isText =
        mime.startsWith("text/") ||
        mime === "application/json" ||
        mime === "application/javascript" ||
        /\.(json|md|txt|csv|tsv|js|ts|jsx|tsx|py|html|css|xml|yaml|yml|toml|sql|sh|log)$/i.test(
          file.originalFilename || ""
        );
      if (!isText) {
        outputParts.push(`### ${file.originalFilename || "output file"}\n(Binary file — content not shown)`);
        continue;
      }
      try {
        const content = await fs.readFile(file.filepath, "utf8");
        const truncated =
          content.length > 50000
            ? content.slice(0, 50000) + "\n... (truncated at 50 000 chars)"
            : content;
        outputParts.push(`### ${file.originalFilename || "output file"}\n\`\`\`\n${truncated}\n\`\`\``);
      } catch {
        outputParts.push(`### ${file.originalFilename || "output file"}\n(Unable to read file content)`);
      }
    }
    const outputSummary = outputParts.join("\n\n") || "";

    const promptTemplate = await readPromptTemplate();
    const finalPrompt = buildPrompt(promptTemplate, {
      assessmentQuestion,
      conversationContent,
      inhouseTranscript,
      screenshotSummary,
      outputSummary,
      customInstructions,
    });

    // Build multi-modal input: text prompt + screenshot images
    const MAX_IMAGES = 5;
    if (uploadedScreenshots.length > MAX_IMAGES) {
      return res.status(400).json({
        error: `Maximum ${MAX_IMAGES} images allowed per evaluation, but ${uploadedScreenshots.length} were provided`,
      });
    }

    const inputContent = [{ type: "input_text", text: finalPrompt }];
    for (const screenshot of uploadedScreenshots) {
      inputContent.push({
        type: "input_image",
        image_url: screenshot.url,
        detail: "high",
      });
    }

    function sectionSchema(subScoreKeys) {
      const props = {};
      for (const key of subScoreKeys) props[key] = { type: "number" };
      return {
        type: "object",
        additionalProperties: false,
        required: ["subScores", "comments"],
        properties: {
          subScores: {
            type: "object",
            additionalProperties: false,
            required: subScoreKeys,
            properties: props,
          },
          comments: { type: "string" },
        },
      };
    }

    const evaluationSchema = {
      type: "object",
      additionalProperties: false,
      required: [
        "helperBotConversation",
        "outputQuality",
        "transcriptionQuality",
        "overallScore",
        "analysis",
      ],
      properties: {
        helperBotConversation: sectionSchema([
          "questionRelevance",
          "engagementDepth",
          "strategicThinking",
          "learningProgression",
          "practicalApplication",
        ]),
        outputQuality: sectionSchema([
          "taskCompletion",
          "technicalAccuracy",
          "presentationClarity",
          "documentationQuality",
          "innovationCreativity",
        ]),
        transcriptionQuality: sectionSchema([
          "clarityExpression",
          "technicalCommunication",
          "structureFlow",
          "completeness",
          "professionalism",
        ]),
        overallScore: { type: "number" },
        analysis: {
          type: "object",
          additionalProperties: false,
          required: [
            "strengths",
            "areasForImprovement",
            "keyObservations",
            "recommendation",
          ],
          properties: {
            strengths: { type: "array", items: { type: "string" } },
            areasForImprovement: { type: "array", items: { type: "string" } },
            keyObservations: { type: "array", items: { type: "string" } },
            recommendation: { type: "string" },
          },
        },
      },
    };

    const response = await openai.responses.create({
      model: "gpt-4.1",
      tools: [{ type: "web_search" }],
      instructions:
        "You are a strict evaluator. Return valid JSON only, matching the schema in the prompt.",
      input: [{ role: "user", content: inputContent }],
      text: {
        format: {
          type: "json_schema",
          name: "EvaluationResult",
          strict: true,
          schema: evaluationSchema,
        },
      },
      temperature: 0.2,
    });

    const rawOutput = response.output_text || "{}";
    await appendLog(finalPrompt, rawOutput);

    const parsedEvaluation = safeJsonParse(rawOutput);
    if (!parsedEvaluation) {
      return res.status(500).json({
        error: "Model returned invalid JSON",
      });
    }

    // Programmatic score audit — fix arithmetic inconsistencies
    const auditedEvaluation = auditScores(parsedEvaluation);

    return res.status(200).json({
      evaluation: auditedEvaluation,
      metadata: {
        recordingUrl,
        recordingDurationSeconds: normalizedRecordingDurationSeconds,
        recorderId,
        candidate: {
          name: candidateName || "",
          email: candidateEmail || "",
        },
        submittedFiles,
      },
    });
  } catch (error) {
    const internalMessage = error instanceof Error ? error.message : "Unknown server error";
    console.error("[evaluate]", internalMessage);
    await appendLog("Unable to build prompt", "{}", internalMessage);
    return res.status(500).json({ error: "Evaluation failed. Please try again." });
  } finally {
    // Clean up formidable temp files
    for (const file of allTempFiles) {
      if (file?.filepath) {
        fs.unlink(file.filepath).catch(() => {});
      }
    }
  }
}
