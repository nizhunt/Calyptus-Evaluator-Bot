import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    assessmentQuestion,
    conversationContent,
    transcriptionLink,
    screenshots,
    outputFiles,
  } = req.body;

  try {
    const promptTemplatePath = path.join(
      process.cwd(),
      "..",
      "evaluation_prompt.md"
    );
    const promptTemplate = fs.readFileSync(promptTemplatePath, "utf8");

    let fullPrompt = promptTemplate
      .replace("[INSERT_ASSESSMENT_QUESTION]", assessmentQuestion)
      .replace("[INSERT_CONVERSATION_MARKDOWN]", conversationContent)
      .replace("[INSERT_TRANSCRIPTION_LINK]", transcriptionLink)
      .replace("[INSERT_SCREENSHOT_DESCRIPTIONS_OR_LINKS]", screenshots)
      .replace("[INSERT_OUTPUT_FILE_DESCRIPTIONS_OR_CONTENT]", outputFiles);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an AI evaluator." },
        { role: "user", content: fullPrompt },
      ],
    });

    const evaluation = completion.choices[0].message.content;
    res.status(200).json({ evaluation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error processing evaluation" });
  }
}
