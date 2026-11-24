export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.HYPIXEL_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Hypixel API is not configured. Add HYPIXEL_API_KEY to Vercel Production and redeploy." });
  }

  try {
    const upstream = await fetch("https://api.hypixel.net/v2/skyblock/bazaar", {
      headers: { Accept: "application/json", "API-Key": apiKey },
      signal: AbortSignal.timeout(12000)
    });

    if (upstream.status === 429) {
      const retryAfter = upstream.headers.get("retry-after");
      if (retryAfter) res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({ error: "Hypixel rate limit reached. Please retry shortly." });
    }
    if (!upstream.ok) {
      return res.status(502).json({ error: "Hypixel Bazaar lookup failed (HTTP " + upstream.status + ")." });
    }

    const payload = await upstream.json();
    if (payload?.success !== true || !payload.products || typeof payload.products !== "object") {
      return res.status(502).json({ error: "Hypixel returned an invalid Bazaar response." });
    }

    const products = Object.entries(payload.products).map(([productId, product]) => {
      const quick = product?.quick_status || {};
      const buyPrice = Number(quick.buyPrice);
      const sellPrice = Number(quick.sellPrice);
      const buyVolume = Number(quick.buyVolume);
      const sellVolume = Number(quick.sellVolume);
      const buyOrders = Number(quick.buyOrders);
      const sellOrders = Number(quick.sellOrders);
      const spread = sellPrice - buyPrice;
      const spreadPercent = buyPrice > 0 ? (spread / buyPrice) * 100 : 0;
      return {
        productId,
        buyPrice: Number.isFinite(buyPrice) ? buyPrice : null,
        sellPrice: Number.isFinite(sellPrice) ? sellPrice : null,
        spread: Number.isFinite(spread) ? spread : null,
        spreadPercent: Number.isFinite(spreadPercent) ? spreadPercent : null,
        buyVolume: Number.isFinite(buyVolume) ? buyVolume : 0,
        sellVolume: Number.isFinite(sellVolume) ? sellVolume : 0,
        buyOrders: Number.isFinite(buyOrders) ? buyOrders : 0,
        sellOrders: Number.isFinite(sellOrders) ? sellOrders : 0,
        sellMovingWeek: Number(quick.sellMovingWeek) || 0,
        buyMovingWeek: Number(quick.buyMovingWeek) || 0
      };
    });

    const opportunities = products
      .filter((item) =>
        item.buyPrice > item.sellPrice &&
        item.buyVolume >= 100 &&
        item.sellVolume >= 100 &&
        item.buyOrders >= 3 &&
        item.sellOrders >= 3 &&
        (item.buyMovingWeek + item.sellMovingWeek) >= 1000
      )
      .sort((a, b) => b.spreadPercent - a.spreadPercent)
      .slice(0, 15);

    res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=40");
    return res.status(200).json({
      source: "Hypixel Public API v2 Bazaar",
      lastUpdated: Number(payload.lastUpdated) || Date.now(),
      productCount: products.length,
      opportunities,
      note: "Candidates require at least 100 units of live depth on both sides, 3 orders on each side, and 1,000 combined units of weekly volume. Gross order-flip spread is sell-offer price minus buy-order price; it is not guaranteed profit because queue position, fill time, undercutting, taxes, and other costs are not deducted."
    });
  } catch (error) {
    console.error("SkyProfit Bazaar proxy error:", error?.name || "Error", error?.message || "");
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? "Hypixel Bazaar lookup timed out. Please retry." : "Could not complete the Hypixel Bazaar lookup."
    });
  }
}
