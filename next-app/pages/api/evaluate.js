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
    const veltTranscript = fields.veltTranscript?.[0] || '';
    const recordingUrl = fields.recordingUrl[0];

    // Process screenshots as base64 for GPT-4o vision
    const screenshotImages = [];
    const screenshots = files.screenshots || [];
    const screenshotArray = Array.isArray(screenshots) ? screenshots : [screenshots];
    
    for (const screenshot of screenshotArray) {
      if (screenshot && screenshot.filepath) {
        // Upload to blob for storage/reference
        const blob = await put(screenshot.originalFilename, fs.createReadStream(screenshot.filepath), { access: 'public' });
        
        // Convert to base64 for GPT-4o
        const imageBuffer = fs.readFileSync(screenshot.filepath);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = screenshot.mimetype || 'image/png';
        
        screenshotImages.push({
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${base64Image}`
          }
        });
      }
    }

    // Process output file content
    let outputFileContent = '';
    let outputFileUrl = '';
    if (files.outputFile) {
      const outputFile = files.outputFile[0];
      // Upload to blob for storage
      const blob = await put(outputFile.originalFilename, fs.createReadStream(outputFile.filepath), { access: 'public' });
      outputFileUrl = blob.url;
      
      // Read file content based on type
      const fileExtension = path.extname(outputFile.originalFilename).toLowerCase();
      if (['.json', '.md', '.txt', '.js', '.py', '.html', '.css'].includes(fileExtension)) {
        try {
          outputFileContent = fs.readFileSync(outputFile.filepath, 'utf8');
          // Truncate if too large (keep under 50k characters)
          if (outputFileContent.length > 50000) {
            outputFileContent = outputFileContent.substring(0, 50000) + '\n\n[Content truncated due to length]';
          }
        } catch (error) {
          outputFileContent = `Error reading file content: ${error.message}`;
        }
      } else {
        outputFileContent = `File type ${fileExtension} - content not readable as text. File URL: ${outputFileUrl}`;
      }
    }

    const promptTemplatePath = path.join(
      process.cwd(),
      "data",
      "evaluation_prompt.md"
    );
    const promptTemplate = fs.readFileSync(promptTemplatePath, "utf8");

    // Prepare multimodal message content
    const messageContent = [
      {
        type: "text",
        text: promptTemplate
          .replace("[INSERT_ASSESSMENT_QUESTION]", assessmentQuestion)
          .replace("[INSERT_CONVERSATION_MARKDOWN]", conversationContent)
          .replace("[INSERT_TRANSCRIPT_CONTENT]", veltTranscript)
          .replace("[INSERT_SCREENSHOT_DESCRIPTIONS_OR_LINKS]", screenshotImages.length > 0 ? "Screenshots provided below for visual analysis" : "No screenshots provided")
          .replace("[INSERT_OUTPUT_FILE_DESCRIPTIONS_OR_CONTENT]", outputFileContent || "No output file provided")
      },
      ...screenshotImages
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an AI evaluator with vision capabilities. Analyze all provided materials including text, images, and file contents to provide comprehensive evaluation." },
        { role: "user", content: messageContent },
      ],
      max_tokens: 4000,
    });

    const evaluation = completion.choices[0].message.content;

    const metadata = {
      submittedFiles: [
        ...screenshotImages.map((_, index) => ({ name: `screenshot_${index + 1}`, type: 'image', processed: 'base64_analysis' })),
        ...(outputFileUrl ? [{ name: 'outputFile', url: outputFileUrl, contentProcessed: outputFileContent ? 'yes' : 'no' }] : [])
      ],
      modelUsed: 'gpt-4o',
      multimodalProcessing: true
    };

    res.status(200).json({ evaluation, metadata });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error processing evaluation" });
  }
}
