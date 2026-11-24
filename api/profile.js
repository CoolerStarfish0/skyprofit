export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const username = String(req.query.username || "").trim();
  const requestedProfileId = String(req.query.profileId || "").trim();
  if (!/^[A-Za-z0-9_]{1,16}$/.test(username)) {
    return res.status(400).json({ error: "Enter a valid Minecraft username." });
  }

  const apiKey = process.env.HYPIXEL_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Hypixel API is not configured. Add HYPIXEL_API_KEY to the Vercel Production environment and redeploy."
    });
  }

  const timeout = (ms) => AbortSignal.timeout(ms);
  const normalizeUuid = (value) => String(value || "").replace(/-/g, "").toLowerCase();

  try {
    const mojangResponse = await fetch(
      "https://api.mojang.com/users/profiles/minecraft/" + encodeURIComponent(username),
      {
        headers: { Accept: "application/json" },
        signal: timeout(12000)
      }
    );

    if (mojangResponse.status === 404) {
      return res.status(404).json({ error: "That Minecraft username was not found. Check the spelling and try again." });
    }
    if (!mojangResponse.ok) {
      return res.status(502).json({ error: "Minecraft username lookup is temporarily unavailable (HTTP " + mojangResponse.status + "). Try again shortly." });
    }

    const player = await mojangResponse.json();
    if (!player || !player.id) {
      return res.status(404).json({ error: "That Minecraft username could not be resolved to a player UUID." });
    }

    const uuid = normalizeUuid(player.id);
    const hypixelResponse = await fetch(
      "https://api.hypixel.net/v2/skyblock/profiles?uuid=" + encodeURIComponent(uuid),
      {
        headers: {
          Accept: "application/json",
          "API-Key": apiKey
        },
        signal: timeout(15000)
      }
    );

    if (hypixelResponse.status === 403) {
      const rejected = await hypixelResponse.json().catch(() => ({}));
      const reason = String(rejected?.cause || "").slice(0, 120);
      return res.status(502).json({
        error: reason
          ? "Hypixel rejected the API key: " + reason + ". Check the key in Vercel."
          : "Hypixel rejected the API key. Check that HYPIXEL_API_KEY is valid in the Vercel Production environment, then redeploy."
      });
    }
    if (hypixelResponse.status === 429) {
      const retryAfter = hypixelResponse.headers.get("retry-after");
      if (retryAfter) res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({ error: "Hypixel API rate limit reached. Wait a little and try again." });
    }
    if (!hypixelResponse.ok) {
      return res.status(502).json({ error: "Hypixel profile lookup failed (HTTP " + hypixelResponse.status + "). Try again shortly." });
    }

    const payload = await hypixelResponse.json();
    if (!payload || payload.success !== true) {
      const cause = String(payload?.cause || "");
      if (/key|auth|unauthor/i.test(cause)) {
        return res.status(502).json({ error: "Hypixel rejected the API key. Check HYPIXEL_API_KEY in Vercel." });
      }
      return res.status(502).json({ error: "Hypixel returned an unsuccessful profile response. Please try again shortly." });
    }

    const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
    if (!profiles.length) {
      return res.status(404).json({ error: "No SkyBlock profiles were found for " + (player.name || username) + ". The player may not have created a profile or their profiles may be private." });
    }

    const getMember = (profile) => {
      const members = profile && profile.members && typeof profile.members === "object" ? profile.members : {};
      const key = Object.keys(members).find((candidate) => normalizeUuid(candidate) === uuid);
      return key ? members[key] : null;
    };

    const candidates = profiles
      .map((profile) => ({ profile, member: getMember(profile) }))
      .filter((entry) => entry.member);

    if (!candidates.length) {
      return res.status(404).json({ error: "Hypixel returned profiles, but no member data was found for this player." });
    }

    const profileOptions = candidates.map(({ profile, member: profileMember }) => ({
      profileId: profile.profile_id || null,
      profileName: profile.cute_name || "Unnamed profile",
      selected: Boolean(profile.selected),
      lastSave: Number(profileMember.last_save || 0) || null
    }));
    let selected;
    if (requestedProfileId) {
      selected = candidates.find(({ profile }) => String(profile.profile_id || "") === requestedProfileId);
      if (!selected) {
        return res.status(404).json({ error: "That SkyBlock profile is no longer available for this player. Refresh the profile list and try again." });
      }
    } else {
      candidates.sort((a, b) => {
        if (Boolean(a.profile.selected) !== Boolean(b.profile.selected)) return a.profile.selected ? -1 : 1;
        return Number(b.member.last_save || 0) - Number(a.member.last_save || 0);
      });
      selected = candidates[0];
    }
    const member = selected.member;
    const skillExperience = {};
    for (const [key, value] of Object.entries(member)) {
      if (/^experience_skill_[a-z0-9_]+$/i.test(key) && Number.isFinite(Number(value))) {
        skillExperience[key.replace(/^experience_skill_/i, "")] = Number(value);
      }
    }

    const rawCollections = member.collection && typeof member.collection === "object" ? member.collection : {};
    const collections = Object.entries(rawCollections)
      .filter(([, amount]) => Number.isFinite(Number(amount)))
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 50)
      .map(([id, amount]) => ({ id, amount: Number(amount) }));

    const rawPets = Array.isArray(member.pets?.pets) ? member.pets.pets : [];
    const pets = rawPets.slice(0, 30).map((pet) => ({
      type: pet.type || null,
      tier: pet.tier || null,
      exp: Number.isFinite(Number(pet.exp)) ? Number(pet.exp) : null,
      active: Boolean(pet.active),
      heldItem: pet.heldItem || null,
      candyUsed: Number.isFinite(Number(pet.candyUsed)) ? Number(pet.candyUsed) : null
    }));

    const inventory = member.inventory && typeof member.inventory === "object" ? member.inventory : {};
    const inventorySections = Object.keys(inventory).filter((key) => {
      const value = inventory[key];
      return value && typeof value === "object" && (typeof value.data === "string" || typeof value === "string");
    });

    const result = {
      source: "Hypixel Public API v2",
      player: { username: player.name || username, uuid },
      selectedProfile: {
        profileId: selected.profile.profile_id || null,
        profileName: selected.profile.cute_name || null,
        selected: Boolean(selected.profile.selected),
        lastSave: Number(member.last_save || 0) || null,
        bankBalance: Number(selected.profile.banking?.balance ?? selected.profile.bank?.balance ?? 0) || 0
      },
      availableProfiles: profileOptions,
      otherProfiles: profileOptions.filter((profile) => profile.profileId !== selected.profile.profile_id),
      progression: {
        coinPurse: Number(member.coin_purse ?? member.currencies?.coin_purse ?? 0) || 0,
        skillExperience,
        leveling: member.leveling || null,
        slayers: member.slayer_bosses || null,
        dungeons: member.dungeons || null,
        collections,
        collectionTypesReturned: Object.keys(rawCollections).length,
        pets,
        mining: member.mining_core || null,
        jacob: member.jacob2 ? {
          perks: member.jacob2.perks || null,
          medals: member.jacob2.medals_inv || null
        } : null,
        garden: member.garden_player_data || member.garden_data || null
      },
      inventory: {
        sectionsAvailable: inventorySections,
        decoded: false,
        note: "Hypixel supplies inventory contents as encoded NBT. Gear and accessory item details are not decoded by this endpoint yet; do not infer them."
      },
      dataNotes: [
        "Only the selected profile's member progression is included. availableProfiles contains profile IDs and display metadata for this account.",
        "Collections are limited to the 50 largest numeric totals.",
        "Inventory NBT is not decoded, so equipped gear and accessories are unavailable."
      ]
    };

    res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=40");
    return res.status(200).json(result);
  } catch (error) {
    console.error("SkyProfit Hypixel profile proxy error:", error?.name || "Error", error?.message || "");
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      return res.status(504).json({ error: "The profile lookup timed out. Please try again." });
    }
    return res.status(502).json({ error: "Could not complete the Hypixel profile lookup. Please try again shortly." });
  }
}
