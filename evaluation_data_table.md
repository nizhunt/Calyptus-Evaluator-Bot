# LLM Evaluation Data Table

This table shows exactly what information is being sent to the LLM for evaluation, including the data source, format, and how it's processed.

| **Data Field** | **Source** | **Format** | **Processing** | **LLM Prompt Placeholder** | **Purpose** |
|---|---|---|---|---|---|
| **Assessment Question** | Frontend form input (`assessmentQuestion` state) | Plain text string | Direct pass-through | `[INSERT_ASSESSMENT_QUESTION]` | Provides the original task/question for context |
| **Conversation Content** | Chat messages array OR uploaded markdown file | Formatted markdown string | Messages formatted as `**SENDER:** content` with double newlines between messages | `[INSERT_CONVERSATION_MARKDOWN]` | Shows candidate's interaction with AI helper bot |
| **Velt Transcript** | Velt recorder transcription (`window.veltTranscript`) | Plain text string | Extracted from Velt recording segments and stored globally | `[INSERT_TRANSCRIPT_CONTENT]` | Candidate's verbal explanation/presentation |
| **Screenshot URLs** | File uploads (up to 3 screenshots) | Array of public URLs | Files uploaded to Vercel Blob storage, URLs joined with commas | `[INSERT_SCREENSHOT_DESCRIPTIONS_OR_LINKS]` | Visual evidence of candidate's work |
| **Output File URL** | Single file upload (optional) | Public URL string | File uploaded to Vercel Blob storage | `[INSERT_OUTPUT_FILE_DESCRIPTIONS_OR_CONTENT]` | Candidate's deliverable/output file |
| **Recording URL** | Form input (for testing only) | URL string | Direct pass-through (not used in current prompt) | Not used in prompt | Legacy field for video recordings |

## Data Flow Process

### 1. Frontend Data Collection (`pages/index.js`)
```javascript
// Form submission collects:
formData.append("assessmentQuestion", assessmentQuestion);
formData.append("conversationContent", conversationContent);
formData.append("veltTranscript", window.veltTranscript || '');
formData.append("recordingUrl", recordingUrl);
formData.append("screenshots", screenshot); // Multiple files
formData.append("outputFile", outputFile); // Single file
```

### 2. Backend Processing (`pages/api/evaluate.js`)
```javascript
// Files uploaded to Vercel Blob storage
const blob = await put(screenshot.originalFilename, 
  fs.createReadStream(screenshot.filepath), 
  { access: 'public' }
);
screenshotUrls.push(blob.url);

// Prompt template populated
let fullPrompt = promptTemplate
  .replace("[INSERT_ASSESSMENT_QUESTION]", assessmentQuestion)
  .replace("[INSERT_CONVERSATION_MARKDOWN]", conversationContent)
  .replace("[INSERT_TRANSCRIPT_CONTENT]", veltTranscript)
  .replace("[INSERT_SCREENSHOT_DESCRIPTIONS_OR_LINKS]", screenshotUrls.join(', '))
  .replace("[INSERT_OUTPUT_FILE_DESCRIPTIONS_OR_CONTENT]", outputFileUrl);
```

### 3. LLM API Call
```javascript
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are an AI evaluator." },
    { role: "user", content: fullPrompt }, // Contains all populated data
  ],
});
```

## Evaluation Prompt Structure

The LLM receives a structured prompt from `data/evaluation_prompt.md` with the following sections:

1. **Context & Instructions** - Evaluation framework and scoring guidelines
2. **Materials to Analyze** - All the populated data fields listed above
3. **Evaluation Criteria** - Three main dimensions:
   - Helper Bot Conversation Quality (30% weight)
   - Output Quality (50% weight) 
   - Transcription Quality (20% weight)
4. **Expected Response Format** - JSON schema for structured evaluation results

## Key Data Sources

| **Component** | **Data Collected** | **Storage Method** |
|---|---|---|
| **Chat Interface** | User questions and AI responses | In-memory state array, formatted to markdown |
| **Velt Recorder** | Screen recording with transcription | Transcript stored in `window.veltTranscript` |
| **File Uploads** | Screenshots and output files | Uploaded to Vercel Blob, URLs stored |
| **Form Inputs** | Assessment question, recording links | Direct form state |

## Response Format

The LLM returns a structured JSON evaluation with:
- Scores for each dimension (0-10)
- Sub-scores for detailed criteria (0-2 each)
- Detailed comments and analysis
- Overall weighted score
- Strengths, improvements, and recommendations

This data is then saved to `data/evaluations.json` and displayed on a dynamic evaluation page.