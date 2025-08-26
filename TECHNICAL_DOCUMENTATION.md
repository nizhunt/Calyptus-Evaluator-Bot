# Technical Documentation: Helperbot Interface Project

## Project Overview

The Helperbot Interface is an AI-powered evaluation tool designed to assess candidate performance on assessment tasks. It includes a web interface for interactive chat with an AI assistant, submission of evaluation materials, and generation of structured evaluations using OpenAI's API. The project evolved from a simple HTML interface and standalone scripts to a full Next.js application for better scalability and user experience.

### Key Features
- Interactive chat interface for assessment guidance
- Form submission for evaluation materials (links, screenshots, files)
- AI-powered evaluation using a custom prompt template
- Persistent storage of evaluations in JSON format
- Dynamic pages for viewing individual evaluations
- Loading states and user feedback during processing

This documentation is structured for both human readers and AI models, with clear sections, bullet points, and code examples for easy parsing and understanding.

## Project Structure

The project is organized as follows:

- **Root Directory** (`/Users/nishantsingh/Code/Calyptus/Helperbot Interface/`):
  - `evaluation_prompt.md`: Markdown file containing the evaluation prompt template with placeholders for dynamic content.
  - `evaluator.js`: Standalone Node.js script for command-line evaluation (predecessor to the web app).
  - `evaluator.py`: Standalone Python script for command-line evaluation.
  - `index.html`: Original HTML interface with JavaScript for basic functionality.
  - `next-app/`: Main Next.js application directory.
  - `TECHNICAL_DOCUMENTATION.md`: This file.

- **Next.js App Directory** (`next-app/`):
  - `.env.local`: Local environment variables (e.g., OPENAI_API_KEY).
  - `.gitignore`: Git ignore file for excluding build artifacts, node_modules, etc.
  - `package.json`: Project dependencies and scripts (e.g., Next.js, React, OpenAI).
  - `pages/`: Next.js pages and API routes.
    - `_app.js`: Custom App component for global setup.
    - `_document.js`: Custom Document for HTML structure and fonts.
    - `api/`: API endpoints.
      - `chat.js`: Handles chat messages to OpenAI.
      - `evaluate.js`: Processes evaluation requests using OpenAI.
      - `save-evaluation.js`: Saves and retrieves evaluations from JSON storage.
    - `evaluation/[id].js`: Dynamic page for viewing specific evaluations.
    - `index.js`: Main page with chat interface and submission form.
  - `styles/globals.css`: Global CSS styles.
  - `tailwind.config.js` and `postcss.config.js`: Configuration for Tailwind CSS.
  - `.next/`: Build artifacts (ignored in Git).

## Technical Stack

- **Framework**: Next.js (v14.2.3) for server-side rendering, API routes, and dynamic pages.
- **Frontend**: React (v18) for component-based UI.
- **Styling**: Tailwind CSS for utility-first styling, with custom fonts (e.g., Reenie Beanie).
- **AI Integration**: OpenAI SDK (v4.0.0) for chat completions using models like gpt-4o-mini.
- **Storage**: File-based JSON (`data/evaluations.json`) for simple persistence of evaluation results.
- **Dependencies**: Listed in `package.json` (e.g., next, react, react-dom, openai).
- **Environment**: Node.js for runtime; macOS-compatible commands.

## Architecture and Design Decisions

### Overall Architecture
The application follows a client-server model within Next.js:
- **Frontend**: React components manage state (e.g., chat messages, form inputs) and UI (chat bubbles, modals, loading indicators).
- **Backend**: API routes handle requests to OpenAI and data persistence.
- **Data Flow**:
  1. User inputs assessment question and chats with AI via `/api/chat`.
  2. On submission, data is sent to `/api/evaluate` for OpenAI processing.
  3. Evaluation is saved via `/api/save-evaluation` with a unique ID.
  4. User is redirected to `/evaluation/[id]` for viewing.

### Key Design Decisions
- **From HTML to Next.js**: Started with a static HTML interface (`index.html`) for simplicity, but migrated to Next.js for better state management, routing, and API integration. This allows for dynamic content and server-side logic without a separate backend.
- **API Endpoints**: Used Next.js API routes for seamless integration. For example:
  - `chat.js` uses OpenAI's chat completions for contextual responses based on the assessment question.
  - `evaluate.js` loads a prompt template from `evaluation_prompt.md`, replaces placeholders, and queries OpenAI.
  - `save-evaluation.js` uses file-system storage for evaluations to keep it lightweight (no database needed for this scale).
- **State Management**: React hooks (useState, useEffect, useRef) handle chat messages, loading states, and form data. No external state library (e.g., Redux) to keep it simple.
- **UI/UX Choices**: Tailwind CSS for rapid, responsive styling. Added loading indicators and modals for better user feedback. Removed unnecessary features like download buttons to streamline the interface.
- **Security**: API key stored in environment variables (`.env.local`), not hardcoded. Follows best practices to avoid exposing secrets.
- **Persistence**: JSON file for evaluations allows easy access and scalability for small-scale use; can be extended to a database if needed.
- **Optimization for AI Models**: Structured prompt in `evaluation_prompt.md` with clear placeholders and guidelines. Documentation uses semantic headings and lists for easy parsing.
- **Error Handling**: Basic try-catch in API routes; user alerts for frontend errors.
- **Port Choice**: Development server on port 3001 to avoid conflicts.

### Code Examples

#### Chat API Endpoint (`pages/api/chat.js`)
```javascript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { assessmentQuestion, message } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are an AI assistant helping with the assessment task: ${assessmentQuestion}` },
        { role: "user", content: message },
      ],
    });
    res.status(200).json({ response: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: "Error generating response" });
  }
}
```

#### Evaluation Submission in `index.js`
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  const conversationContent = messages.map(msg => `**${msg.sender.toUpperCase()}:** ${msg.content}`).join('\n\n');
  try {
    const res = await fetch('/api/evaluate', { method: 'POST', body: JSON.stringify({ ... }) });
    const data = await res.json();
    const saveRes = await fetch('/api/save-evaluation', { method: 'POST', body: JSON.stringify({ evaluation: data.evaluation }) });
    const saveData = await saveRes.json();
    router.push(`/evaluation/${saveData.id}`);
  } catch (error) {
    alert('Error: ' + error.message);
  }
  setLoading(false);
};
```

## Setup and Running the Project

1. **Install Dependencies**: `cd next-app && npm install`
2. **Set Environment Variables**: Add `OPENAI_API_KEY` to `.env.local`
3. **Run Development Server**: `npm run dev -- -p 3001` (accessible at http://localhost:3001)
4. **Build for Production**: `npm run build && npm start`

## Potential Improvements
- Integrate a database for evaluations.
- Add authentication for secure access.
- Enhance error handling and logging.

This documentation provides a complete guide to understanding and extending the project.