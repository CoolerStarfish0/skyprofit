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
    element.textContent = token.slice(2, isBold ? -2 : -1);
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
    ["PRODUCT ID", "BUY ORDER", "SELL ORDER", "SPREAD", "SPREAD %", "WEEKLY VOLUME"].forEach(label => {
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
    "Analyze the selected Hypixel SkyBlock profile and identify money-making methods that are genuinely supported by its progression and the attached live Bazaar snapshot.",
    "Minecraft username: " + username,
    "Selected playstyle: " + selectedStyle + " — " + styleDescriptions[selectedStyle],
    "SELECTED PROFILE DATA (official Hypixel Public API v2):",
    profileJson,
    "BAZAAR SNAPSHOT (official Hypixel Public API v2; prices may change; do not treat order-book spread as guaranteed profit):",
    JSON.stringify(marketSnapshot),
    "",
    "Begin with exactly one line: TOP_METHOD: <specific supported method> or TOP_METHOD: Insufficient profile data.",
    "Evidence rules:",
    "- Never use dungeon class, mob kills, secrets, damage, score, deaths, or general combat activity as evidence of money-making ability. These metrics are deliberately excluded from the profile summary.",
    "- Do not invent unlocks, gear, item drops, collection levels, skill levels, coins/hour, prices, profit, or requirements.",
    "- Inventory NBT is not decoded; never guess weapons, armor, tools, equipment, or accessories.",
    "- Use Bazaar data only as a current market snapshot. A positive order-book spread is theoretical and does not prove a profitable flip. Mention volume and liquidity, and state that taxes, queue position, undercutting, and fill risk can change results.",
    "- Consider the selected profile's actual purse/bank, skills, collections, mining progression, Garden/Jacob data, slayer progression, pets and other returned unlocks only where they directly support a method.",
    "- If data supports fewer than three methods, list fewer. If no method is supported, do not pad the answer with generic or hypothetical ideas; explain exactly which useful data is missing.",
    "- For every recommended method give: profile evidence, why it is unlocked/appropriate, missing requirements or costs, and what the player should verify next.",
    "- Distinguish observed facts from recommendations. Do not present hypothetical inference as a recommendation.",
    "Use concise headings: Profile facts, Supported methods, Missing data, Next step, Confidence."
  ].join("\n");
  let response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({
        prompt,
        system: "You are SkyProfit, a strict evidence-first Hypixel SkyBlock money-making analyst powered by Axon. Your job is to avoid false recommendations. Never fabricate profile facts, current prices, Bazaar opportunities, profit rates, gear, unlocks, or requirements. Dungeon performance metrics are not evidence of money-making ability. Recommend only methods directly supported by supplied profile progression and market data. If evidence is insufficient, say so plainly.",
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
    const coinTotal = Number(profile.progression.coinPurse || 0) + Number(profile.selectedProfile.bankBalance || 0);
    if (statValues[1]) statValues[1].textContent = formatCoins(coinTotal);
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

loadBazaar();

document.querySelectorAll(".nav-item").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    link.classList.add("active");
  });
});
