# LLM Guide: Creating Custom Assessment Tests

This guide shows Large Language Models (LLMs) how to create custom assessment test links for the Calyptus Assessment Platform using a simple API.

## Quick Start

To create a custom test, make a POST request to `/api/generate-test` with:

- **id**: External identifier for this test request
- **is_test**: Boolean flag. `true` routes completion results to the dev Calyptus API, `false` routes them to prod
- **employerName**: Company/organization name
- **question**: The assessment task or question
- **emailId**: Contact email
- **customInstructions**: Optional evaluation criteria

Authentication required via `Authorization: Bearer <GENERATE_TEST_API_KEY>`.

## API Reference

### Generate Test

**POST** `/api/generate-test`

**Headers:**

```http
Authorization: Bearer <GENERATE_TEST_API_KEY>
Content-Type: application/json
```

**Request:**

```json
{
  "id": "3c31d38b-ef02-4845-a23a-312abd56c151",
  "is_test": true,
  "employerName": "Tech Corp",
  "question": "Build a React component for user authentication",
  "emailId": "hr@techcorp.com",
  "customInstructions": "Focus on security and code quality" // optional
}
```

**Response:**

```json
{
  "id": "3c31d38b-ef02-4845-a23a-312abd56c151",
  "is_test": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "testUrl": "https://assessment.calyptus.co/?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "employerName": "Tech Corp",
  "question": "Build a React component for user authentication",
  "customInstructions": "Focus on security and code quality",
  "emailId": "hr@techcorp.com"
}
```

### Validate Token

**POST** `/api/validate-token`

**Request:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**

```json
{
  "id": "3c31d38b-ef02-4845-a23a-312abd56c151",
  "is_test": true,
  "employerName": "Tech Corp",
  "question": "Build a React component for user authentication",
  "customInstructions": "Focus on security and code quality",
  "emailId": "hr@techcorp.com",
  "createdAt": 1640995200
}
```

## Usage Examples

### Basic Test Creation

```javascript
const response = await fetch("/api/generate-test", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.GENERATE_TEST_API_KEY}`,
  },
  body: JSON.stringify({
    id: "3c31d38b-ef02-4845-a23a-312abd56c151",
    is_test: true,
    employerName: "Acme Corp",
    question: "Create a REST API for a todo application",
    emailId: "hiring@acme.com",
  }),
});

const { testUrl } = await response.json();
console.log("Share this link:", testUrl);
```

### Test with Custom Evaluation Criteria

```javascript
const response = await fetch("/api/generate-test", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.GENERATE_TEST_API_KEY}`,
  },
  body: JSON.stringify({
    id: "3c31d38b-ef02-4845-a23a-312abd56c151",
    is_test: false,
    employerName: "TechStart Inc",
    question: "Build a real-time chat application using WebSockets",
    emailId: "tech@techstart.com",
    customInstructions:
      "Evaluate: 1) Real-time implementation, 2) Error handling, 3) Code architecture, 4) Security considerations",
  }),
});

const data = await response.json();
```

## Custom Evaluation Instructions

Custom instructions let you specify additional evaluation criteria beyond the standard assessment. They are:

- **Optional** - standard criteria apply if not provided
- **Integrated** - automatically added to the AI evaluation prompt
- **Flexible** - can focus on technical skills, soft skills, or specific requirements

**Examples:**

- "Focus on code security and vulnerability prevention"
- "Evaluate communication skills and technical explanation ability"
- "Prioritize scalability and performance optimization"
- "Assess React, Node.js, and PostgreSQL knowledge"

## Token Details

**JWT Payload:**

```json
{
  "id": "3c31d38b-ef02-4845-a23a-312abd56c151",
  "is_test": true,
  "employerName": "Company Name",
  "question": "Assessment task",
  "customInstructions": "Custom criteria (optional)",
  "emailId": "contact@company.com",
  "iat": 1640995200
}
```

**Key Features:**

- Tokens never expire (permanent access)
- Signed with JWT_SECRET for security
- Automatically detected in URL parameters
- Makes assessment interface read-only when present

## Error Responses

```json
// Missing required fields
{ "error": "ID, is_test, employer name, question, and email ID are required" }

// Invalid token
{ "error": "Invalid token signature" }

// Wrong HTTP method
{ "error": "Method not allowed" }

// Missing or invalid API key
{ "error": "Unauthorized" }
```

## Best Practices

1. **Input Validation**: Ensure all required fields are provided
2. **Error Handling**: Handle API errors gracefully
3. **Clear Instructions**: Make custom evaluation criteria specific and actionable
4. **Secure Sharing**: Use HTTPS when sharing test URLs
5. **API Key Handling**: Store `GENERATE_TEST_API_KEY` only in server-side environment variables
6. **Token Storage**: Tokens are permanent - store them securely if needed

That's it! The API handles JWT generation, token validation, and integration with the assessment platform automatically.
