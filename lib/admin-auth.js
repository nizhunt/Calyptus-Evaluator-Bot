import crypto from "crypto";

export const ADMIN_SESSION_COOKIE = "calyptus_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24;

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET or JWT_SECRET environment variable must be set");
  }
  return secret;
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function signPayload(payloadBase64) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payloadBase64)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function parseCookieHeader(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index === -1) return acc;
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

export function isAllowedCalyptusEmail(email) {
  if (!email || typeof email !== "string") return false;
  return email.toLowerCase().endsWith("@calyptus.co");
}

export function createAdminSessionToken(user) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    email: user.email,
    name: user.name || "",
    picture: user.picture || "",
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TTL_SECONDS,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token) {
  if (!token || typeof token !== "string") return null;

  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  const expectedSignature = signPayload(payloadPart);
  const receivedSignatureBuffer = Buffer.from(signaturePart);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (receivedSignatureBuffer.length !== expectedSignatureBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart));
    if (!payload?.email || !payload?.exp) return null;
    if (Math.floor(Date.now() / 1000) >= payload.exp) return null;
    if (!isAllowedCalyptusEmail(payload.email)) return null;
    return payload;
  } catch {
    return null;
  }
}

function buildCookie(name, value, maxAge) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function setAdminSessionCookie(res, user) {
  const token = createAdminSessionToken(user);
  res.setHeader("Set-Cookie", buildCookie(ADMIN_SESSION_COOKIE, token, SESSION_TTL_SECONDS));
}

export function clearAdminSessionCookie(res) {
  res.setHeader("Set-Cookie", buildCookie(ADMIN_SESSION_COOKIE, "", 0));
}

export function getAdminSessionFromRequest(req) {
  const cookies = parseCookieHeader(req.headers?.cookie || "");
  return verifyAdminSessionToken(cookies[ADMIN_SESSION_COOKIE]);
}

export function requireAdminApiSession(req, res) {
  const session = getAdminSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return session;
}

export function requireAdminPageSession(context) {
  const session = getAdminSessionFromRequest(context.req);
  if (!session) {
    return {
      redirect: {
        destination: "/admin/login",
        permanent: false,
      },
      session: null,
    };
  }

  return {
    session,
    redirect: null,
  };
}
