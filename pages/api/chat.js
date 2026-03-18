import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const DEFAULT_CHAT_MODELS = ["gpt-4.1-mini", "gpt-4.1"];

async function readPromptTemplate() {
  const promptPath = path.join(
    process.cwd(),
    "data",
    "prompts",
    "helperbot-prompt.md"
  );
  return fs.readFile(promptPath, "utf8");
}

function buildSystemPrompt(template, assessmentQuestion) {
  const question = assessmentQuestion || "Not provided";
  return template.replace("[INSERT_ASSESSMENT_QUESTION]", question);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res
      .status(500)
      .json({ error: "Server misconfiguration: OPENAI_API_KEY is missing" });
  }

  const { assessmentQuestion, message, history = [] } = req.body;

  try {
    const promptTemplate = await readPromptTemplate();
    const systemPrompt = buildSystemPrompt(promptTemplate, assessmentQuestion);

    const historyMessages = Array.isArray(history)
      ? history
          .filter((item) => item && typeof item.content === "string")
          .map((item) => ({
            role: item.sender === "bot" ? "assistant" : "user",
            content: item.content,
          }))
      : [];

    if (historyMessages.length === 0 && typeof message === "string" && message.trim()) {
      historyMessages.push({ role: "user", content: message.trim() });
    }

    const modelCandidates = getChatModelCandidates();
    let response = null;
    let lastError = null;

    for (const model of modelCandidates) {
      try {
        response = await openai.responses.create({
          model,
          instructions: systemPrompt,
          input: historyMessages,
        });
        break;
      } catch (error) {
        lastError = error;
        if (!isModelSelectionError(error)) {
          throw error;
        }
        console.warn(`[chat] model '${model}' unavailable, trying fallback`, {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!response) {
      throw lastError || new Error("No chat model available");
    }

    const botResponse = extractResponseText(response) || "No response received";

    res.status(200).json({ response: botResponse });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error generating response";
    console.error("Chat API error:", error);
    res.status(500).json({ error: message });
  }
}

function getChatModelCandidates() {
  const envModel = typeof process.env.OPENAI_CHAT_MODEL === "string"
    ? process.env.OPENAI_CHAT_MODEL.trim()
    : "";
  const models = envModel ? [envModel, ...DEFAULT_CHAT_MODELS] : DEFAULT_CHAT_MODELS;
  return Array.from(new Set(models.filter(Boolean)));
}

function isModelSelectionError(error) {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number(error.status)
    : null;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (status === 404) return true;
  return (
    message.includes("model") &&
    (
      message.includes("does not exist") ||
      message.includes("not found") ||
      message.includes("unsupported") ||
      message.includes("not compatible") ||
      message.includes("for this endpoint")
    )
  );
}

function extractResponseText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const parts = [];
  if (Array.isArray(response?.output)) {
    for (const item of response.output) {
      if (item?.type !== "message" || !Array.isArray(item.content)) continue;
      for (const contentItem of item.content) {
        if (typeof contentItem?.text === "string" && contentItem.text.trim()) {
          parts.push(contentItem.text.trim());
        }
      }
    }
  }
  return parts.join("\n").trim();
}
