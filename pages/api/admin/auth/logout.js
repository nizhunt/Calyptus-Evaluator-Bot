import { clearAdminSessionCookie } from "../../../../lib/admin-auth";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  clearAdminSessionCookie(res);
  return res.status(200).json({ ok: true });
}
