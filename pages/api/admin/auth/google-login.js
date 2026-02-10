import {
  isAllowedCalyptusEmail,
  setAdminSessionCookie,
} from "../../../../lib/admin-auth";

async function verifyGoogleToken(credential) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
    credential
  )}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to verify Google credential");
  }

  const tokenInfo = await response.json();

  const expectedClientId =
    process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (expectedClientId && tokenInfo.aud !== expectedClientId) {
    throw new Error("Google credential audience mismatch");
  }

  const email = (tokenInfo.email || "").toLowerCase();
  const isVerified =
    tokenInfo.email_verified === true || tokenInfo.email_verified === "true";

  if (!email || !isVerified) {
    throw new Error("Google account email is not verified");
  }

  if (!isAllowedCalyptusEmail(email)) {
    throw new Error("Only @calyptus.co accounts are allowed");
  }

  return {
    email,
    name: tokenInfo.name || "",
    picture: tokenInfo.picture || "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { credential } = req.body || {};

  if (!credential) {
    return res.status(400).json({ error: "Missing Google credential" });
  }

  try {
    const user = await verifyGoogleToken(credential);
    setAdminSessionCookie(res, user);

    return res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    return res.status(401).json({
      error: error instanceof Error ? error.message : "Authentication failed",
    });
  }
}
