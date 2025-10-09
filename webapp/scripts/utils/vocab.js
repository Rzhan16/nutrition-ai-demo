const fsp = require("fs/promises");
const path = require("path");

const CACHE_FILENAME = "vocab-cache.json";
const SNAPSHOT_DIR = path.join(process.cwd(), "webapp", "batch_ocr_out");
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, CACHE_FILENAME);
const RESULTS_DIR = path.join(process.cwd(), "webapp", "batch_ocr_out", "results");
const SEED_TS_PATH = path.join(process.cwd(), "prisma", "seed.ts");
const SEED_JS_PATH = path.join(process.cwd(), "prisma", "seed.js");
const PRODUCTS_JSON_PATH = path.join(process.cwd(), "data", "products.json");

function normalizeForOcr(value = "") {
  if (typeof value !== "string") return "";
  let str = value.normalize("NFKD");
  str = str.replace(/[\u0300-\u036f]/g, "");
  str = str.toLowerCase();
  str = str.replace(/[\-_]+/g, " ");
  str = str.replace(/0/g, "o");
  str = str.replace(/1/g, "l");
  str = str.replace(/5/g, "s");
  str = str.replace(/8/g, "b");
  str = str.replace(/rn/g, "m");
  str = str.replace(/[^a-z0-9\s\+\/]/g, " ");
  str = str.replace(/\s+/g, " ");
  return str.trim();
}

function levenshtein(a = "", b = "") {
  const s = a || "";
  const t = b || "";
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = new Array(t.length + 1);
  const curr = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    const sc = s.charCodeAt(i - 1);
    for (let j = 1; j <= t.length; j++) {
      const cost = sc === t.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    for (let j = 0; j <= t.length; j++) {
      prev[j] = curr[j];
    }
  }
  return prev[t.length];
}

function getCandidatesByHeuristics(input = "", pool = [], cap = 200) {
  if (!Array.isArray(pool) || !pool.length) return [];
  const normInput = normalizeForOcr(input);
  if (!normInput) return [];
  const maxLenDiff = Math.max(2, Math.floor(normInput.length * 0.3));
  const first = normInput[0];
  const last = normInput[normInput.length - 1];
  const scored = [];
  const seen = new Set();
  for (const candidate of pool) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    const normCandidate = normalizeForOcr(candidate);
    if (!normCandidate || seen.has(normCandidate)) continue;
    const lenDiff = Math.abs(normCandidate.length - normInput.length);
    if (lenDiff > maxLenDiff) continue;
    if (normCandidate.length && normInput.length) {
      const firstMatch = normCandidate[0] === first;
      const lastMatch = normCandidate[normCandidate.length - 1] === last;
      if (!(firstMatch || lastMatch)) continue;
    }
    scored.push({ candidate, normCandidate, lenDiff });
    seen.add(normCandidate);
  }
  scored.sort((a, b) => a.lenDiff - b.lenDiff);
  return scored.slice(0, cap).map((entry) => entry.candidate);
}

function createCategoryMaps() {
  return {
    brand: new Map(),
    product: new Map(),
    ingredient: new Map(),
    common: new Map(),
  };
}

function addToCategory(map, category, word) {
  if (!word || typeof word !== "string") return;
  const normalized = normalizeForOcr(word);
  if (!normalized) return;
  if (!map[category]) map[category] = new Map();
  if (!map[category].has(normalized)) {
    map[category].set(normalized, word.trim());
  }
}

async function loadSnapshot(map) {
  try {
    const raw = await fsp.readFile(SNAPSHOT_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    for (const category of ["brand", "product", "ingredient", "common"]) {
      const values = Array.isArray(parsed?.[category]) ? parsed[category] : [];
      for (const word of values) {
        addToCategory(map, category, word);
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn(`[WARN] Failed to load vocab snapshot: ${error.message}`);
    }
  }
}

async function readJsonFileIfExists(filePath) {
  try {
    const raw = await fsp.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn(`[WARN] Failed to parse JSON from ${filePath}: ${error.message}`);
    }
  }
  return null;
}

function parseSeedFile(content, map) {
  if (!content) return;
  const brandRegex = /brand\s*:\s*"([^"]+)"/g;
  const nameRegex = /name\s*:\s*"([^"]+)"/g;
  const ingredientRegex = /\{\s*name\s*:\s*"([^"]+)"/g;

  let match;
  while ((match = brandRegex.exec(content))) {
    addToCategory(map, "brand", match[1]);
  }
  while ((match = nameRegex.exec(content))) {
    addToCategory(map, "product", match[1]);
  }
  while ((match = ingredientRegex.exec(content))) {
    addToCategory(map, "ingredient", match[1]);
  }
}

async function loadSeedData(map, { useSeed }) {
  if (!useSeed) return;
  const seedJson = await readJsonFileIfExists(PRODUCTS_JSON_PATH);
  if (Array.isArray(seedJson)) {
    for (const entry of seedJson) {
      if (entry?.brand) addToCategory(map, "brand", entry.brand);
      if (entry?.name) addToCategory(map, "product", entry.name);
      if (Array.isArray(entry?.ingredients)) {
        for (const ingredient of entry.ingredients) {
          addToCategory(map, "ingredient", ingredient);
        }
      }
    }
  }

  for (const seedPath of [SEED_TS_PATH, SEED_JS_PATH]) {
    try {
      const raw = await fsp.readFile(seedPath, "utf-8");
      parseSeedFile(raw, map);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn(`[WARN] Failed to read ${path.relative(process.cwd(), seedPath)}: ${error.message}`);
      }
    }
  }
}

async function loadHistory(map, { useHistory }) {
  if (!useHistory) return;
  try {
    const files = await fsp.readdir(RESULTS_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const fullPath = path.join(RESULTS_DIR, file);
      try {
        const raw = await fsp.readFile(fullPath, "utf-8");
        const parsed = JSON.parse(raw);
        const words = Array.isArray(parsed?.ocr?.words) ? parsed.ocr.words : [];
        for (const word of words) {
          const text = word?.text;
          const confidence = Number(word?.confidence) || 0;
          if (confidence >= 0.9 && typeof text === "string") {
            addToCategory(map, "common", text);
          }
        }
        const corrections = Array.isArray(parsed?.corrections) ? parsed.corrections : [];
        for (const entry of corrections) {
          if (entry?.text_corrected) {
            addToCategory(map, "common", entry.text_corrected);
          }
        }
      } catch (error) {
        console.warn(`[WARN] Failed to parse history result ${file}: ${error.message}`);
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn(`[WARN] Failed to scan history results: ${error.message}`);
    }
  }
}

function mapsToArrays(map) {
  const result = {};
  const allSet = new Map();
  for (const category of Object.keys(map)) {
    result[category] = Array.from(map[category].values());
    for (const value of result[category]) {
      const normalized = normalizeForOcr(value);
      if (normalized && !allSet.has(normalized)) {
        allSet.set(normalized, value);
      }
    }
  }
  result.all = Array.from(allSet.values());
  return result;
}

async function writeSnapshotIfRequested(vocab, writeSnapshot) {
  if (!writeSnapshot) return;
  try {
    await fsp.mkdir(SNAPSHOT_DIR, { recursive: true });
    await fsp.writeFile(SNAPSHOT_PATH, JSON.stringify(vocab, null, 2), "utf-8");
  } catch (error) {
    console.warn(`[WARN] Failed to write vocab snapshot: ${error.message}`);
  }
}

async function buildVocab(options = {}) {
  const { useSeed = true, useHistory = true, writeSnapshot = false } = options;
  const categoryMaps = createCategoryMaps();
  await loadSnapshot(categoryMaps);
  await loadSeedData(categoryMaps, { useSeed });
  await loadHistory(categoryMaps, { useHistory });
  const vocab = mapsToArrays(categoryMaps);
  await writeSnapshotIfRequested(vocab, writeSnapshot);
  return vocab;
}

module.exports = {
  buildVocab,
  normalizeForOcr,
  getCandidatesByHeuristics,
  levenshtein,
};
