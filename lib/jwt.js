import crypto from "crypto";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

export function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function base64UrlDecode(str) {
  str += "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(
    str.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString();
}

export function createSignature(data, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function verifyToken(token, secret = getJwtSecret()) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const [header, payload, signature] = parts;
  const expectedSignature = createSignature(`${header}.${payload}`, secret);

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error("Invalid signature");
  }

  const decodedPayload = JSON.parse(base64UrlDecode(payload));

  if (decodedPayload.exp && Date.now() >= decodedPayload.exp * 1000) {
    throw new Error("Token expired");
  }

  return decodedPayload;
}

export function generateToken(payload, secret = getJwtSecret(), expiresIn = "infinity") {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  let expiration = null;
  if (expiresIn === "infinity") {
    // No expiration
  } else if (expiresIn.endsWith("d")) {
    const days = parseInt(expiresIn.slice(0, -1));
    expiration = now + days * 24 * 60 * 60;
  } else if (expiresIn.endsWith("h")) {
    const hours = parseInt(expiresIn.slice(0, -1));
    expiration = now + hours * 60 * 60;
  } else if (expiresIn.endsWith("m")) {
    const minutes = parseInt(expiresIn.slice(0, -1));
    expiration = now + minutes * 60;
  } else if (expiresIn.endsWith("s")) {
    const seconds = parseInt(expiresIn.slice(0, -1));
    expiration = now + seconds;
  } else {
    throw new Error(`Invalid expiresIn format: "${expiresIn}". Use "30d", "24h", "30m", or "3600s".`);
  }

  const tokenPayload = { ...payload, iat: now };
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
