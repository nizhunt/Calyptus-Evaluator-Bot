import { generateToken } from "../../lib/jwt";
import { authorizeGenerateTestRequest } from "../../lib/generate-test-auth";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!authorizeGenerateTestRequest(req, res)) {
    return;
  }

  const {
    id,
    is_test,
    employerName,
    question,
    customInstructions,
    emailId,
    expiresIn,
  } =
    req.body;

  if (!id || typeof is_test !== "boolean" || !employerName || !question || !emailId) {
    return res.status(400).json({
      error: "ID, is_test, employer name, question, and email ID are required",
    });
  }

  // Validate expiresIn to prevent arbitrary token lifespans
  const allowedExpirations = ["1d", "3d", "7d", "14d", "30d", "infinity"];
  const normalizedExpiry = expiresIn || "infinity";
  if (!allowedExpirations.includes(normalizedExpiry)) {
    return res.status(400).json({
      error: `Invalid expiresIn value. Allowed: ${allowedExpirations.join(", ")}`,
    });
  }

  try {
    const token = generateToken(
      { id, is_test, employerName, question, customInstructions, emailId },
      undefined,
      normalizedExpiry
    );

    const baseUrl =
      process.env.VERCEL_ENV === "production"
        ? process.env.BASE_URL_PROD
        : process.env.BASE_URL_LOCAL;
    const testUrl = `${baseUrl}/?token=${token}`;

    res.status(200).json({
      id,
      is_test,
      token,
      testUrl,
      employerName,
      question,
      customInstructions,
      emailId,
      expiresIn: normalizedExpiry,
    });
  } catch (error) {
    console.error("[generate-test]", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "Failed to generate test" });
  }
}
