import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import formidable from "formidable";
import OpenAI from "openai";
import { put } from "@vercel/blob";

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

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function readPromptTemplate() {
  const promptPath = path.join(process.cwd(), "data", "evaluation_prompt.md");
  return fs.readFile(promptPath, "utf8");
}

function buildPrompt(template, data) {
  return template
    .replace("[INSERT_CUSTOM_INSTRUCTIONS]", data.customInstructions || "None")
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

  try {
    const { fields, files } = await parseMultipartForm(req);

    const assessmentQuestion = normalizeField(fields.assessmentQuestion);
    const conversationContent = normalizeField(fields.conversationContent);
    const inhouseTranscript = normalizeField(fields.inhouseTranscript);
    const recordingUrl = normalizeField(fields.recordingUrl);
    const recorderId = normalizeField(fields.recorderId);
    const customInstructions = normalizeField(fields.customInstructions);
    const candidateName = normalizeField(fields.candidateName);
    const candidateEmail = normalizeField(fields.candidateEmail);

    const screenshotFiles = normalizeFiles(files.screenshots);
    const outputFiles = normalizeFiles(files.outputFile);

    const screenshotSummary =
      screenshotFiles.length > 0
        ? screenshotFiles
            .map((file, idx) => `${idx + 1}. ${file.originalFilename || "screenshot"}`)
            .join("\n")
        : "";

    const outputSummary =
      outputFiles.length > 0
        ? outputFiles
            .map((file, idx) => `${idx + 1}. ${file.originalFilename || "output file"}`)
            .join("\n")
        : "";

    const promptTemplate = await readPromptTemplate();
    const finalPrompt = buildPrompt(promptTemplate, {
      assessmentQuestion,
      conversationContent,
      inhouseTranscript,
      screenshotSummary,
      outputSummary,
      customInstructions,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a strict evaluator. Return valid JSON only, matching the schema in the prompt.",
        },
        { role: "user", content: finalPrompt },
      ],
      temperature: 0.2,
    });

    const rawOutput = completion.choices?.[0]?.message?.content || "{}";
    await appendLog(finalPrompt, rawOutput);

    const parsedEvaluation = safeJsonParse(rawOutput);
    if (!parsedEvaluation) {
      return res.status(500).json({
        error: "Model returned invalid JSON",
      });
    }

    const submittedFiles = [];
    for (const file of [...screenshotFiles, ...outputFiles]) {
      try {
        const uploaded = await maybeUploadFile(file);
        if (uploaded) submittedFiles.push(uploaded);
      } catch {
        // Ignore upload failures so evaluation can still succeed.
      }
    }

    return res.status(200).json({
      evaluation: JSON.stringify(parsedEvaluation),
      metadata: {
        recordingUrl,
        recorderId,
        candidate: {
          name: candidateName || "",
          email: candidateEmail || "",
        },
        submittedFiles,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    await appendLog("Unable to build prompt", "{}", message);
    return res.status(500).json({ error: message });
  }
}
