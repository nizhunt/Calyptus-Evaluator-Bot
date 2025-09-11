const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Base64 URL encode function
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// Create HMAC SHA256 signature
function createSignature(data, secret) {
  const crypto = require("crypto");
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// Generate JWT token
function generateToken(payload, secret, expiresIn = "infinity") {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  let expiration;

  // Parse expiration time
  if (expiresIn === "infinity") {
    // Don't set expiration for infinite tokens
    expiration = null;
  } else if (expiresIn.endsWith("d")) {
    const days = parseInt(expiresIn.slice(0, -1));
    expiration = now + days * 24 * 60 * 60;
  } else {
    expiration = now + parseInt(expiresIn);
  }

  const tokenPayload = {
    ...payload,
    iat: now,
  };

  // Only add exp if expiration is set
  if (expiration !== null) {
    tokenPayload.exp = expiration;
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = createSignature(
    `${encodedHeader}.${encodedPayload}`,
    secret
  );

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { employerName, question, customInstructions, emailId, expiresIn } =
    req.body;

  if (!employerName || !question || !emailId) {
    return res.status(400).json({
      error: "Employer name, question, and email ID are required",
    });
  }

  try {
    const token = generateToken(
      { employerName, question, customInstructions, emailId },
      JWT_SECRET,
      expiresIn || "infinity"
    );

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001";
    const testUrl = `${baseUrl}/?token=${token}`;

    res.status(200).json({
      token,
      testUrl,
      employerName,
      question,
      customInstructions,
      emailId,
      expiresIn: expiresIn || "7d",
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to generate test: " + error.message });
  }
}
