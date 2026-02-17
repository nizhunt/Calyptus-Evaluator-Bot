import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
      ],
      temperature: 0.3,
    });

    const botResponse =
      completion.choices?.[0]?.message?.content?.trim() || "No response received";

    res.status(200).json({ response: botResponse });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error generating response";
    console.error("Chat API error:", message);
    res.status(500).json({ error: message });
  }
}
