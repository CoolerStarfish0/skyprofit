export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const username = String(req.query.username || "").trim();
  if (!/^[A-Za-z0-9_]{1,16}$/.test(username)) {
    return res.status(400).json({ error: "Invalid Minecraft username." });
  }

  try {
    const upstream = await fetch(
      "https://sky.shiiyu.moe/api/v2/profile/" + encodeURIComponent(username),
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000)
      }
    );

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: upstream.status === 404
          ? "No public SkyBlock profile was found for that username."
          : "SkyCrypt profile lookup failed (HTTP " + upstream.status + ")."
      });
    }

    const profile = await upstream.json();
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      return res.status(502).json({ error: "SkyCrypt returned an invalid profile response." });
    }

    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json(profile);
  } catch (error) {
    console.error("SkyProfit profile proxy error:", error);
    return res.status(502).json({ error: "Could not reach SkyCrypt. Please try again shortly." });
  }
}
