import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBVnqD6sw9KTthjB8ZaSHFFC8cn5Hyxn_U",
  authDomain: "ai-ef2a5.firebaseapp.com",
  projectId: "ai-ef2a5",
  storageBucket: "ai-ef2a5.firebasestorage.app",
  messagingSenderId: "573112672263",
  appId: "1:573112672263:web:df128e854e3fcca7950aa2"
};
const app = initializeApp(firebaseConfig, "skyprofit-axon-bridge");
const auth = getAuth(app);

const styleDescriptions = {
  money: "Prioritizing the highest realistic profit, regardless of effort.",
  chill: "Prioritizing low-effort methods such as flipping and passive income.",
  balanced: "Balancing earning potential with time, effort and setup cost.",
  active: "Prioritizing active gameplay methods you can participate in."
};
let selectedStyle = "money";
const styleButtons = [...document.querySelectorAll(".playstyle")];
const styleNote = document.getElementById("style-note");
const form = document.getElementById("profile-form");
const input = document.getElementById("username");
const message = document.getElementById("profile-message");
const output = document.querySelector(".empty-state");
const topStatus = document.querySelector(".top-actions .muted");

function renderInlineMarkdown(parent, text) {
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
    const token = match[0];
    const isBold = token.startsWith("**") || token.startsWith("__");
    const element = document.createElement(isBold ? "strong" : "em");
    element.textContent = token.slice(isBold ? 2 : 1, isBold ? -2 : -1);
    parent.append(element);
    cursor = match.index + token.length;
  }
  if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
}

function renderMarkdown(container, markdown) {
  container.replaceChildren();
  const normalized = String(markdown || "")
    .replace(/\r/g, "")
    .replace(/\s+(?=#{1,4}\s)/g, "\n")
    .replace(/\s+(?=\d+[.)]\s+\*\*)/g, "\n")
    .replace(/\s+(?=---+\s*(?:\n|$))/g, "\n")
    .replace(/---+\s*(?=#{1,4}\s)/g, "\n\n");
  const lines = normalized.split("\n");
  let paragraph = [];
  let list = null;
  const flushParagraph = () => {
    if (!paragraph.length) return;
    const p = document.createElement("p");
    renderInlineMarkdown(p, paragraph.join(" "));
    container.append(p);
    paragraph = [];
  };
  const flushList = () => { list = null; };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    if (/^[-*_]{3,}$/.test(line)) { flushParagraph(); flushList(); container.append(document.createElement("hr")); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const h = document.createElement("h" + Math.min(heading[1].length + 1, 4));
      renderInlineMarkdown(h, heading[2].replace(/\s+#+$/, ""));
      container.append(h);
      continue;
    }
    const unordered = line.match(/^[-*+]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const kind = unordered ? "ul" : "ol";
      if (!list || list.tagName.toLowerCase() !== kind) {
        flushList();
        list = document.createElement(kind);
        container.append(list);
      }
      const item = document.createElement("li");
      renderInlineMarkdown(item, (unordered || ordered)[1]);
      list.append(item);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
}

function getTopMethod(answer) {
  const raw = String(answer || "").replace(/\r/g, "");
  const explicit = raw.match(/TOP_METHOD\s*:\s*(.+)/i);
  if (explicit) {
    const value = explicit[1].replace(/\*\*/g, "").replace(/^\s*[-#]+\s*/, "").trim();
    if (value && !/^(unknown|none|n\/a|see analysis)$/i.test(value)) return value.slice(0, 48);
  }

  const heading = /(?:ranked[\s\S]{0,50}(?:progression\s+)?methods?|money[- ]making methods|recommended (?:money[- ]making )?methods|top methods|best methods)/i;
  const start = raw.search(heading);
  if (start < 0) return "See analysis";
  let section = raw.slice(start);
  const nextSection = section.search(/(?:^|\n)\s*#{1,4}\s*(?:recommendations?|observed profile facts|confidence levels|missing information)\b/i);
  if (nextSection >= 0) section = section.slice(0, nextSection);

  const patterns = [
    /(?:^|\s)(?:\*\*)?1[.)](?:\*\*)?\s*\*\*([^*\n]+)\*\*/,
    /(?:^|\s)1[.)]\s+([^\n]+)/,
    /(?:^|\s)\*\*1[.)]\s*([^*\n]+)\*\*/
  ];
  for (const pattern of patterns) {
    const match = section.match(pattern);
    if (match && match[1]) {
      const name = match[1].split(/\s+[-—:]\s+/)[0].replace(/[*_#]/g, "").trim();
      if (name && !/^(observed profile facts|dungeon classes|teamwork|efficiency metrics)$/i.test(name)) return name.slice(0, 48);
    }
  }
  return "See analysis";
}
function setStatus(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#f0a18b" : "#a3ef75";
}
function setStyle(style) {
  if (!styleDescriptions[style]) return;
  selectedStyle = style;
  styleButtons.forEach(button => {
    const active = button.dataset.style === style;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  styleNote.textContent = styleDescriptions[style];
  try { localStorage.setItem("skyprofit-playstyle", style); } catch {}
}
styleButtons.forEach(button => button.addEventListener("click", () => setStyle(button.dataset.style)));

try {
  const savedStyle = localStorage.getItem("skyprofit-playstyle");
  if (savedStyle) setStyle(savedStyle);
  const savedUsername = localStorage.getItem("skyprofit-username");
  if (savedUsername) input.value = savedUsername;
} catch {}

const profileSelectorWrap = document.getElementById("profile-selector-wrap");
const profileSelector = document.getElementById("profile-selector");
const selectedProfileNote = document.getElementById("selected-profile-note");
const bazaarContent = document.getElementById("bazaar-content");
const bazaarRefresh = document.getElementById("bazaar-refresh");
let activeUsername = "";
let activeProfileId = "";
let latestBazaar = null;
let bazaarFetchedAt = 0;

const coinFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
function formatCoins(value) {
  const number = Number(value);
  return Number.isFinite(number) ? coinFormatter.format(number) : "Unavailable";
}
function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number >= 1000 ? coinFormatter.format(number) : number.toFixed(2);
}
function formatTime(value) {
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

async function getSkyBlockProfile(username, profileId = "") {
  const params = new URLSearchParams({ username });
  if (profileId) params.set("profileId", profileId);
  let response;
  try {
    response = await fetch("/api/profile?" + params.toString(), { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("Profile lookup connection failed. Check your connection and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Hypixel profile lookup failed (HTTP " + response.status + ").");
  if (!data || typeof data !== "object" || !data.progression || !data.player || !data.selectedProfile) {
    throw new Error("Hypixel returned an incomplete profile response. Please try again.");
  }
  return data;
}

async function loadBazaar() {
  if (bazaarContent) bazaarContent.textContent = "Loading official Hypixel Bazaar data…";
  try {
    const response = await fetch("/api/bazaar", { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Bazaar lookup failed.");
    latestBazaar = data;
    bazaarFetchedAt = Date.now();
    renderBazaar(data);
    const stats = document.querySelectorAll(".stat-grid .stat-card .stat-value");
    const notes = document.querySelectorAll(".stat-grid .stat-card small");
    if (stats[3]) stats[3].textContent = String((data.opportunities || []).length);
    if (notes[3]) notes[3].textContent = "Positive order-book spreads; not guaranteed profit";
    const badge = document.querySelector(".bazaar-panel .pill");
    if (badge) { badge.textContent = "Live market data"; badge.className = "pill neutral"; }
    return data;
  } catch (error) {
    latestBazaar = null;
    if (bazaarContent) bazaarContent.textContent = error.message || "Bazaar data is temporarily unavailable.";
    const badge = document.querySelector(".bazaar-panel .pill");
    if (badge) { badge.textContent = "Unavailable"; badge.className = "pill warning"; }
    return null;
  }
}

function renderBazaar(data) {
  if (!bazaarContent) return;
  bazaarContent.className = "bazaar-live";
  bazaarContent.replaceChildren();
  const rows = Array.isArray(data.opportunities) ? data.opportunities : [];
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.textContent = "No positive-spread products with usable order-book volume were returned right now.";
    bazaarContent.append(empty);
  } else {
    const wrap = document.createElement("div");
    wrap.className = "bazaar-table-wrap";
    const table = document.createElement("table");
    table.className = "bazaar-table";
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["PRODUCT ID", "TOP BUY ORDER", "LOWEST SELL OFFER", "GROSS SPREAD", "SPREAD %", "ORDER DEPTH (BUY / SELL)", "WEEKLY VOLUME"].forEach(label => {
      const th = document.createElement("th"); th.textContent = label; headerRow.append(th);
    });
    head.append(headerRow);
    const body = document.createElement("tbody");
    rows.slice(0, 12).forEach(item => {
      const tr = document.createElement("tr");
      const values = [
        item.productId,
        formatPrice(item.buyPrice),
        formatPrice(item.sellPrice),
        formatPrice(item.spread),
        Number(item.spreadPercent).toFixed(2) + "%",
        formatCoins(item.buyVolume) + " / " + formatCoins(item.sellVolume),
        formatCoins(Number(item.buyMovingWeek || 0) + Number(item.sellMovingWeek || 0))
      ];
      values.forEach((value, index) => {
        const td = document.createElement("td");
        td.textContent = value;
        if (index === 3 || index === 4) td.className = "positive";
        tr.append(td);
      });
      body.append(tr);
    });
    table.append(head, body); wrap.append(table); bazaarContent.append(wrap);
  }
  const meta = document.createElement("div");
  meta.className = "bazaar-meta";
  const count = document.createElement("span");
  count.textContent = formatCoins(data.productCount) + " Bazaar products · Updated " + formatTime(data.lastUpdated);
  const caveat = document.createElement("p");
  caveat.className = "bazaar-caveat";
  caveat.textContent = data.note || "Order-book spread is not guaranteed profit; queue position, fill time, undercutting and fees are not included.";
  meta.append(count); bazaarContent.append(meta, caveat);
}

function renderProfilePicker(profile) {
  if (!profileSelector || !profileSelectorWrap) return;
  const profiles = Array.isArray(profile.availableProfiles) ? profile.availableProfiles : [];
  profileSelector.replaceChildren();
  profiles.forEach(option => {
    if (!option.profileId) return;
    const item = document.createElement("option");
    item.value = option.profileId;
    item.textContent = option.profileName + (option.selected ? " · Hypixel selected" : "");
    profileSelector.append(item);
  });
  profileSelector.disabled = profiles.length < 2;
  profileSelector.value = profile.selectedProfile.profileId || "";
  profileSelectorWrap.hidden = profiles.length === 0;
  const saved = profile.selectedProfile.profileName || "Selected profile";
  if (selectedProfileNote) {
    selectedProfileNote.textContent = profiles.length > 1
      ? saved + " is currently loaded. Switch profiles to analyze another island."
      : saved + " is the only profile returned for this player.";
  }
}

function profileForAnalysis(profile) {
  const p = profile.progression || {};
  return {
    source: profile.source,
    player: profile.player,
    selectedProfile: profile.selectedProfile,
    progression: {
      coinPurse: p.coinPurse,
      skillExperience: p.skillExperience,
      leveling: p.leveling,
      slayers: p.slayers,
      dungeons: p.dungeons,
      kuudra: p.kuudra,
      netherIsland: p.netherIsland,
      collections: p.collections,
      collectionTypesReturned: p.collectionTypesReturned,
      pets: p.pets,
      mining: p.mining,
      jacob: p.jacob,
      garden: p.garden
    },
    inventory: profile.inventory,
    dataNotes: profile.dataNotes
  };
}

async function askAxon(username, profile, bazaar) {
  let token;
  try {
    const credential = await signInAnonymously(auth);
    token = await credential.user.getIdToken(true);
  } catch (error) {
    console.error("SkyProfit Firebase authentication failed:", error);
    throw new Error("Firebase authentication failed. Please refresh the page and try again.");
  }
  const profileJson = JSON.stringify(profileForAnalysis(profile));
  const marketSnapshot = bazaar ? {
    source: bazaar.source,
    lastUpdated: bazaar.lastUpdated,
    opportunities: (bazaar.opportunities || []).slice(0, 12),
    note: bazaar.note
  } : { unavailable: true, reason: "Bazaar endpoint did not return data." };
  const prompt = [
    "Act as a practical Hypixel SkyBlock money-making coach. Recommend actual gameplay methods as well as market trading. Do not reduce the answer to Bazaar flips or collection-item trading.",
    "Minecraft username: " + username,
    "Selected playstyle: " + selectedStyle + " — " + styleDescriptions[selectedStyle],
    "PLAYER-CONFIRMED CAPITAL: The player explicitly confirms they have 60,000,000 coins in their selected profile bank. Treat 60M as their available bank capital even if the API bank field is missing or stale; show API-reported bank separately if it conflicts. The purse is separate spending money.",
    "PLAYER-CONFIRMED COLLECTIONS: Collection values in this profile are accurate. Use them as progression/history signals and possible unlock evidence, but NOT as proof the player currently owns those items, can sell that historical amount, or should grind that item for profit.",
    "SELECTED PROFILE DATA (official Hypixel Public API v2):",
    profileJson,
    "BAZAAR SNAPSHOT (official Hypixel Public API v2; prices may change; order-book spreads are not guaranteed profit):",
    JSON.stringify(marketSnapshot),
    "",
    "Begin with exactly one line: TOP_METHOD: <specific supported method> or TOP_METHOD: Insufficient profile data.",
    "METHODS YOU MUST EVALUATE (do not automatically recommend all of them):",
    "- Kuudra: evaluate entry tier and higher-tier progression, Nether/Kuudra unlock data, combat progression, and the 60M budget. Explain whether the player appears ready, what gear/party requirements remain unknown, and whether a lower tier is a sensible test. Never assume Kuudra access or suitable gear if the profile does not prove it.",
    "- Dungeons (including profitable runs/loot), Slayer bosses, Rift activities, mining, farming, fishing, and other active gameplay methods.",
    "- Bazaar flipping/crafting only when the supplied live market data supports a real opportunity and the method's capital/requirements fit.",
    "- Minions and passive methods only when there is actual evidence to estimate setup and returns.",
    "EVIDENCE RULES:",
    "- Consider 60M bank capital when judging setup affordability and risk. Do not recommend risking all 60M; give a sensible test budget/reserve when a method needs investment.",
    "- Treat accurate collections as historical progression signals, not inventory or guaranteed income. When mentioning large totals (such as Magma Cream, Netherite or other resources), call them collection totals/milestones; never imply the player currently owns that amount or can earn it again at the same rate. Do not recommend grinding Magma Cream or any other collection solely because its total is high.",
    "- Use skills, slayer levels, mining progression, Garden/Jacob data, pets, Nether/Kuudra data, and dungeon data to identify unlocks and prerequisites. Dungeon class, mob kills, secrets, damage, score, or deaths alone are NOT evidence of money-making ability or expected profit.",
    "- Do not invent unlocks, gear, item drops, skill levels, prices, coins/hour, profit rates, party requirements, or completion tiers. Inventory NBT is not decoded; never guess weapons, armor, tools, equipment, or accessories.",
    "- For Kuudra and other combat methods, distinguish confirmed access/progression from unknown gear and party readiness. If essential requirements are missing from the API, mark the method 'promising but needs verification' rather than pretending it is unlocked or impossible.",
    "- Evaluate the full set of gameplay methods even if Bazaar opportunities are empty. An empty Bazaar candidate list only means no qualifying Bazaar flips were found right now; it does not mean there are no money-making methods in the game.",
    "- Use live Bazaar data only for current market estimates. Mention liquidity and fill risk; do not claim gross spread is guaranteed profit. If opportunities are empty, say no qualifying Bazaar flips were found, then continue evaluating gameplay methods.",
    "- Rank methods by realistic suitability, not just theoretical maximum coins/hour. For each method include: recommendation status (ready / conditional / not enough data), profile evidence, estimated setup-cost range only if supported, requirements to verify, risk/effort, and why the 60M budget does or does not fit.",
    "- Do not treat bank capital as income or claim a profit/hour without reliable current evidence. If rates are unavailable, say so and explain how to measure them with a short test.",
    "- Give up to 5 genuinely useful options; fewer is fine. Do not pad with generic ideas.",
    "Use concise headings: Profile facts, Best money-making methods, What to verify, Suggested budget, Confidence."
  ].join("\n");
  let response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({
        prompt,
        system: "You are SkyProfit, a practical Hypixel SkyBlock money-making coach. Evaluate active gameplay methods such as Kuudra, dungeons, slayers, Rift, mining, farming and fishing alongside Bazaar flips. Use the player-confirmed 60M bank capital and accurate collections correctly. Never fabricate access, gear, prices, profit rates or requirements; clearly label uncertain readiness and suggest what to verify. Dungeon performance metrics alone are not evidence of profit.",
        context: "",
        workMode: false,
        adminAction: null,
        targetUser: null
      })
    });
  } catch (error) {
    console.error("SkyProfit analysis request failed:", error);
    throw new Error("SkyProfit could not contact its analysis service. Please try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Axon AI request failed (HTTP " + response.status + ").");
  if (!data.answer) throw new Error("Axon returned an empty response.");
  return data.answer;
}

async function analyzeSelectedProfile(username, profileId = "") {
  const submit = form.querySelector('button[type="submit"]');
  const statValues = document.querySelectorAll(".stat-grid .stat-card .stat-value");
  const overviewPill = document.querySelector(".section-heading .pill");
  submit.disabled = true;
  submit.textContent = "Analyzing…";
  output.replaceChildren();
  if (statValues[0]) statValues[0].textContent = username;
  if (statValues[2]) statValues[2].textContent = "Fetching profile…";
  if (overviewPill) overviewPill.textContent = "Fetching profile";
  const loading = document.createElement("p");
  loading.textContent = "Fetching your SkyBlock profile…";
  output.append(loading);
  if (topStatus) topStatus.textContent = "Connecting to Hypixel";
  setStatus("Loading the selected SkyBlock profile…");
  if (profileSelector) profileSelector.disabled = true;
  try {
    let profile;
    try {
      profile = await getSkyBlockProfile(username, profileId);
    } catch (error) {
      if (!profileId || !/no longer available|not found/i.test(error.message)) throw error;
      profile = await getSkyBlockProfile(username);
    }
    activeUsername = username;
    activeProfileId = profile.selectedProfile.profileId || "";
    renderProfilePicker(profile);
    try { localStorage.setItem("skyprofit-profile:" + username.toLowerCase(), activeProfileId); } catch {}
    loading.textContent = "Profile found. Checking Bazaar data and asking Axon AI…";
    if (statValues[2]) statValues[2].textContent = "Analyzing…";
    if (overviewPill) overviewPill.textContent = "Profile loaded";
    const purse = profile.progression.coinPurse;
    const bank = profile.selectedProfile.bankBalance;
    const coinTotal = purse == null || bank == null ? null : Number(purse) + Number(bank);
    if (statValues[1]) statValues[1].textContent = coinTotal == null ? "Unavailable" : formatCoins(coinTotal);
    const coinNotes = document.querySelectorAll(".stat-grid .stat-card small");
    if (coinNotes[1]) coinNotes[1].textContent = "Purse + selected profile bank";
    const bazaar = latestBazaar && Date.now() - bazaarFetchedAt < 20000 ? latestBazaar : await loadBazaar();
    const answer = await askAxon(username, profile, bazaar);
    output.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = "Your SkyProfit analysis · " + (profile.selectedProfile.profileName || "Selected profile");
    const result = document.createElement("div");
    result.className = "ai-result";
    renderMarkdown(result, answer);
    output.append(heading, result);
    if (statValues[2]) statValues[2].textContent = getTopMethod(answer);
    const statNotes = document.querySelectorAll(".stat-grid .stat-card small");
    if (statNotes[2]) statNotes[2].textContent = "Top recommendation for " + (profile.selectedProfile.profileName || "selected profile");
    setStatus("Analysis complete for " + (profile.selectedProfile.profileName || "selected profile") + ".");
    if (topStatus) topStatus.textContent = "Hypixel + Axon connected";
    if (overviewPill) overviewPill.textContent = "Profile analyzed";
    const methodsStatus = document.querySelector(".methods-panel .pill");
    if (methodsStatus) methodsStatus.textContent = "AI analyzed";
  } catch (error) {
    output.replaceChildren();
    const errorText = document.createElement("p");
    errorText.textContent = error.message || "Could not analyze this profile.";
    output.append(errorText);
    if (statValues[2]) statValues[2].textContent = "Unavailable";
    setStatus(error.message || "Analysis failed.", true);
    if (topStatus) topStatus.textContent = "Connection issue";
    if (overviewPill) overviewPill.textContent = "Analysis failed";
  } finally {
    submit.disabled = false;
    if (profileSelector) profileSelector.disabled = !profileSelector.options || profileSelector.options.length < 2;
    submit.innerHTML = 'Analyze profile <span>→</span>';
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const username = input.value.trim();
  if (!/^[A-Za-z0-9_]{1,16}$/.test(username)) {
    setStatus("Enter a valid Minecraft username (1–16 letters, numbers or underscores).", true);
    return;
  }
  try { localStorage.setItem("skyprofit-username", username); } catch {}
  let preferredProfileId = "";
  try { preferredProfileId = localStorage.getItem("skyprofit-profile:" + username.toLowerCase()) || ""; } catch {}
  await analyzeSelectedProfile(username, preferredProfileId);
});

if (profileSelector) {
  profileSelector.addEventListener("change", async () => {
    if (!activeUsername || !profileSelector.value || profileSelector.value === activeProfileId) return;
    await analyzeSelectedProfile(activeUsername, profileSelector.value);
  });
}

if (bazaarRefresh) {
  bazaarRefresh.addEventListener("click", async () => {
    bazaarRefresh.disabled = true;
    bazaarRefresh.textContent = "Refreshing…";
    await loadBazaar();
    bazaarRefresh.disabled = false;
    bazaarRefresh.textContent = "Refresh";
  });
}
loadBazaar();

document.querySelectorAll(".nav-item").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    link.classList.add("active");
  });
});
