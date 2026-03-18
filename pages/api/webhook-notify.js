export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookUrl = process.env.EVALUATION_WEBHOOK_URL;
  if (!webhookUrl) {
    // Silently skip if not configured
    return res.status(200).json({ ok: true, skipped: true });
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[webhook-notify]", error instanceof Error ? error.message : error);
    return res.status(200).json({ ok: true });
  }
}
