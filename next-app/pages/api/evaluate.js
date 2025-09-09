import fs from "fs";
import path from "path";
import OpenAI from "openai";
import formidable from 'formidable';
import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const form = formidable({ multiples: true });
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const assessmentQuestion = fields.assessmentQuestion[0];
    const conversationContent = fields.conversationContent[0];
    const transcript = fields.transcript[0];
    const recordingUrl = fields.recordingUrl[0];

    const screenshotUrls = [];
    const screenshots = files.screenshots || [];
    if (!Array.isArray(screenshots)) screenshots = [screenshots];
    for (const screenshot of screenshots) {
      const blob = await put(screenshot.originalFilename, fs.createReadStream(screenshot.filepath), { access: 'public' });
      screenshotUrls.push(blob.url);
    }

    let outputFileUrl = '';
    if (files.outputFile) {
      const outputFile = files.outputFile[0];
      const blob = await put(outputFile.originalFilename, fs.createReadStream(outputFile.filepath), { access: 'public' });
      outputFileUrl = blob.url;
    }

    const promptTemplatePath = path.join(
      process.cwd(),
      "data",
      "evaluation_prompt.md"
    );
    const promptTemplate = fs.readFileSync(promptTemplatePath, "utf8");

    let fullPrompt = promptTemplate
      .replace("[INSERT_ASSESSMENT_QUESTION]", assessmentQuestion)
      .replace("[INSERT_CONVERSATION_MARKDOWN]", conversationContent)
      .replace("[INSERT_TRANSCRIPT_CONTENT]", transcript || '')
      .replace("[INSERT_SCREENSHOT_DESCRIPTIONS_OR_LINKS]", screenshotUrls.join(', '))
      .replace("[INSERT_OUTPUT_FILE_DESCRIPTIONS_OR_CONTENT]", outputFileUrl);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an AI evaluator." },
        { role: "user", content: fullPrompt },
      ],
    });

    const evaluation = completion.choices[0].message.content;

    const metadata = {
      videoUrl: recordingUrl,
      submittedFiles: [
        ...screenshotUrls.map(url => ({ name: 'screenshot', url })),
        ...(outputFileUrl ? [{ name: 'outputFile', url: outputFileUrl }] : [])
      ]
    };

    res.status(200).json({ evaluation, metadata });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error processing evaluation" });
  }
}
