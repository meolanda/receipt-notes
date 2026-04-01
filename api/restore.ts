export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { APPS_SCRIPT_URL, SECRET_KEY } = process.env;
  if (!APPS_SCRIPT_URL || !SECRET_KEY) {
    return res.status(503).json({ error: "not_configured" });
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secretKey: SECRET_KEY, action: "fetch" }),
      redirect: "follow",
    });

    const text = await response.text();
    try {
      res.json(JSON.parse(text));
    } catch {
      res.json({ error: "Invalid response from sync server" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
