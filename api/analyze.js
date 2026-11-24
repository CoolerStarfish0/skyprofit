const AXON_API = "https://5158-ai-backendpriv.vercel.app/api/chat";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const authorization = req.headers.authorization;
  if (!authorization || !/^Bearer\s+\S+/i.test(authorization)) {
    return res.status(401).json({ error: "Firebase sign-in token is missing. Please retry." });
  }

  const body = req.body;
  if (!body || typeof body !== "object" || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return res.status(400).json({ error: "The profile analysis request was empty or invalid." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const upstream = await fetch(AXON_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
        Accept: "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const raw = await upstream.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }

    if (!upstream.ok) {
      const message = typeof data.error === "string"
        ? data.error
        : "Axon AI returned HTTP " + upstream.status + ".";
      return res.status(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502)
        .json({ error: message, stage: "axon_upstream" });
    }

    if (!data || typeof data.answer !== "string" || !data.answer.trim()) {
      return res.status(502).json({
        error: "Axon AI responded, but its reply was empty or used an unexpected format.",
        stage: "axon_response"
      });
    }

    return res.status(200).json({ answer: data.answer });
  } catch (error) {
    const timedOut = error && error.name === "AbortError";
    console.error("SkyProfit Axon proxy failed:", error);
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut
        ? "Axon AI took too long to respond. Please try again."
        : "SkyProfit could not reach the Axon AI service. Please try again shortly.",
      stage: "axon_connection"
    });
  } finally {
    clearTimeout(timeout);
  }
}
