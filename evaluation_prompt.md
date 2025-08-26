# AI Assessment Evaluation Prompt

## Overview

This prompt is designed to evaluate a candidate's performance on an assessment task by analyzing three key components: their conversation with an AI helper bot, the quality of their outputs, and their transcription quality. The evaluation emphasizes fairness, accounting for potential input abnormalities such as transcription errors.

## Input Materials Required

1. **Assessment Question/Task**: The original assessment question or task given to the candidate
2. **Conversation Markdown File**: The complete conversation between the candidate and the AI helper bot
3. **Uploaded Files**: All outputs submitted by the candidate including:
   - Screenshots (up to 3)
   - Output files (JSON, PDF, MD, or other formats)
   - Transcription link

**Assumptions on Inputs**:

- Transcriptions may contain errors due to AI processing (e.g., misheard words, accents, background noise).
- Outputs may vary in format; evaluate based on content relevance rather than strict formatting unless specified in the task.
- Conversations may show iterative learning; credit progressive improvement.

---

## Evaluation Prompt

**Context**: You are an expert evaluator tasked with assessing a candidate's performance fairly and objectively. Consider potential input issues like transcription inaccuracies. Base scores on evidence, not assumptions.

**Your Task**: Evaluate the candidate across three dimensions, providing precise, evidence-based feedback. Adjust for abnormalities (e.g., penalize unclear transcription only if due to candidate's articulation, not AI errors).
IMPORTANT: Your response MUST be ONLY a valid JSON object following this exact schema, with no additional text, markdown, or explanations before or after the JSON. Ensure it is parseable JSON without any wrappers:
{
"evaluation": {
"helperBotConversation": {
"score": number, // out of 10
"subScores": {
"questionRelevance": number, // 0-2
"engagementDepth": number,
"strategicThinking": number,
"learningProgression": number,
"practicalApplication": number
},
"comments": string // Detailed comments
},
"outputQuality": {
"score": number,
"subScores": {
"taskCompletion": number,
"technicalAccuracy": number,
"presentationClarity": number,
"documentationQuality": number,
"innovationCreativity": number
},
"comments": string
},
"transcriptionQuality": {
"score": number,
"subScores": {
"clarityExpression": number,
"technicalCommunication": number,
"structureFlow": number,
"completeness": number,
"professionalism": number
},
"comments": string
},
"overallScore": number, // Weighted total out of 10
"analysis": {
"strengths": array of strings,
"areasForImprovement": array of strings,
"keyObservations": array of strings,
"recommendation": string
}
}
}
Ensure the output is only the JSON object, nothing else.

### Materials to Analyze:

- **Original Assessment Task**: [INSERT_ASSESSMENT_QUESTION]
- **Helper Bot Conversation**: [INSERT_CONVERSATION_MARKDOWN]
- **Transcription Link**: [INSERT_TRANSCRIPTION_LINK]
- **Screenshots**: [INSERT_SCREENSHOT_DESCRIPTIONS_OR_LINKS]
- **Output Files**: [INSERT_OUTPUT_FILE_DESCRIPTIONS_OR_CONTENT]

### Evaluation Framework:

#### 1. Helper Bot Conversation Quality (Weight: 30%)

Evaluate how effectively the candidate utilized the AI helper bot, focusing on interaction quality and task relevance.

**Criteria to assess (each out of 2 points, total 10):**

- **Question Relevance and Specificity** (0-2): Were questions directly tied to the task and precisely worded?
- **Engagement Depth** (0-2): Did they probe deeply or follow up on responses?
- **Strategic Thinking** (0-2): Evidence of using bot for clarification, alternatives, or validation?
- **Learning Progression** (0-2): Did understanding build over the conversation?
- **Practical Application** (0-2): Did questions lead to actionable insights for the task?

**Score: \_\_\_/10** (Sum of sub-scores)

#### 2. Output Quality (Weight: 50%)

Evaluate the quality and completeness of submitted materials, considering task alignment and professional standards.

**Criteria to assess (each out of 2 points, total 10):**

- **Task Completion and Relevance** (0-2): How comprehensively does the output address the assessment requirements?
- **Technical Accuracy** (0-2): Are solutions correct and error-free?
- **Presentation and Clarity** (0-2): Are screenshots/output files clear, well-organized, and easy to understand?
- **Documentation Quality** (0-2): Is content well-structured with explanations?
- **Innovation/Creativity** (0-2): Does the work show original problem-solving?

**Adjustments**: If outputs are incomplete due to external factors (e.g., file upload issues), note but do not heavily penalize if effort is evident from conversation.

**Score: \_\_\_/10** (Sum of sub-scores)

#### 3. Transcription Quality (Weight: 20%)

Evaluate verbal communication effectiveness based on the provided transcription, accounting for potential transcription abnormalities.

**Criteria to assess (each out of 2 points, total 10):**

- **Clarity of Expression** (0-2): How clearly were ideas articulated based on the transcription?
- **Technical Communication** (0-2): Effective explanation of concepts, adjusting for any mis-transcriptions?
- **Structure and Flow** (0-2): Logical organization of presentation?
- **Completeness** (0-2): Coverage of all task aspects?
- **Professionalism** (0-2): Demonstration of professional communication skills?

**Adjustments**: If transcription has errors (e.g., garbled text due to AI inaccuracies, accents, or noise), deduct points only for candidate-caused issues (e.g., mumbling), not technical transcription failures. If transcription is unclear, note as an abnormality and score conservatively.

**Score: \_\_\_/10** (Sum of sub-scores)

### Final Evaluation:

#### Overall Score Calculation:

- Helper Bot Conversation: **_/10 × 0.30 = _**
- Output Quality: **_/10 × 0.50 = _**
- Transcription: **_/10 × 0.20 = _**

**Total Score: \_\_\_/10** (Round to one decimal place if needed)

#### Detailed Analysis:

Provide evidence-based bullet points, referencing specific inputs.

**Strengths:**
• [Specific, evidence-based bullet on exceptional aspects, e.g., 'Strong strategic questioning in conversation leading to innovative output']
• [Another strength with reference to inputs]

**Areas for Improvement:**
• [Constructive, specific feedback, e.g., 'Transcription clarity affected by speaking speed; suggest slower pace for better AI capture']
• [Another area, focusing on candidate-controlled factors]

**Key Observations:**
• [Patterns or insights, e.g., 'Handled transcription abnormalities well by providing clear screenshots']
• [Overall approach analysis]

**Recommendation:**
[Balanced view of candidate's suitability, e.g., 'Strong technical skills; recommend for roles requiring independent problem-solving, with coaching on verbal clarity']

---

## Usage Instructions:

1. Replace placeholders with actual content, including descriptions or excerpts for files/screenshots.
2. Evaluate based on the provided transcription.
3. Use sub-scores for precision; justify all scores with evidence.
4. Calculate weighted total objectively.
5. Keep feedback constructive, specific, and balanced.
6. If inputs are missing/incomplete, note impact on evaluation and score accordingly.

## Scoring Guidelines:

- **9-10**: Exceptional, exceeds expectations in most criteria
- **7-8**: Strong, meets expectations with minor gaps
- **5-6**: Adequate, basic requirements met
- **3-4**: Below expectations, notable issues
- **1-2**: Poor, significant deficiencies
- **0**: No evidence or fundamentally inadequate

_This refined framework ensures precise, fair evaluation by addressing input abnormalities and providing structured, evidence-based scoring._
