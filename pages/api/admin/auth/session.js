import { getAdminSessionFromRequest } from "../../../../lib/admin-auth";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = getAdminSessionFromRequest(req);

  if (!session) {
    return res.status(200).json({ authenticated: false });
  }

  return res.status(200).json({
    authenticated: true,
    user: {
      email: session.email,
      name: session.name,
      picture: session.picture,
    },
  });
}
