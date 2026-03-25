import crypto from "crypto";
import { getAdminSessionFromRequest } from "./admin-auth";

function getConfiguredApiKey() {
  const apiKey = process.env.GENERATE_TEST_API_KEY;
  if (!apiKey) {
    throw new Error("GENERATE_TEST_API_KEY environment variable is not set");
  }
  return apiKey;
}

function extractBearerToken(req) {
  const authorization = req.headers?.authorization;
  if (typeof authorization !== "string") {
    return "";
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function timingSafeMatch(value, expected) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(valueBuffer, expectedBuffer);
}

export function authorizeGenerateTestRequest(req, res) {
  const adminSession = getAdminSessionFromRequest(req);
  if (adminSession) {
    return true;
  }

  let configuredApiKey;

  try {
    configuredApiKey = getConfiguredApiKey();
  } catch (error) {
    console.error(
      "[generate-test-auth]",
      error instanceof Error ? error.message : error
    );
    res
      .status(500)
      .json({ error: "Generate test API authentication is not configured" });
    return false;
  }

  const providedApiKey = extractBearerToken(req);
  if (!providedApiKey || !timingSafeMatch(providedApiKey, configuredApiKey)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  return true;
}
