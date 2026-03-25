import { verifyToken } from "../../lib/jwt";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    const decoded = verifyToken(token);

    res.status(200).json({
      id: decoded.id,
      is_test: decoded.is_test,
      employerName: decoded.employerName,
      question: decoded.question,
      customInstructions: decoded.customInstructions,
      emailId: decoded.emailId,
      createdAt: decoded.iat,
      expiresAt: decoded.exp,
    });
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
