                                                   # Evaluator App

This is a Next.js application adapted from the original evaluator.js script. It provides a web interface to input evaluation details and uses an API route to securely call the OpenAI API.

## Prerequisites

- Node.js installed
- OpenAI API key
- Vercel account (free tier available)

## Setup

1. Install dependencies:
   ```
   npm install
   ```

Note: Prompt templates are in `data/`:

- Evaluation prompt: `data/evaluation_prompt.md`
- Helper bot prompt: `data/prompts/helperbot-prompt.md`

3. For local development, create a `.env.local` file with:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   GENERATE_TEST_API_KEY=your_generate_test_api_key_here
   EVALUATION_COMPLETE_API_KEY=your_optional_callback_api_key
   ```

4. Run locally:
   ```
   npm run dev
   ```
   Visit http://localhost:3000

## Deployment to Vercel

1. Push the `next-app` directory to a Git repository (e.g., GitHub).

2. Go to Vercel dashboard, create a new project, and import your repository.

3. In the project settings, add an environment variable:
   - Key: OPENAI_API_KEY
   - Value: your_openai_api_key_here

4. Deploy the project. Vercel will handle the build and deployment automatically.

The app will be live on a Vercel URL, and API calls will use the secure environment variable.

Note: This fits within Vercel's free tier for hobby projects, with generous limits for serverless functions.
