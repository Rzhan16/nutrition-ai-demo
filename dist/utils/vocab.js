"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeForOcr = normalizeForOcr;
exports.weightedLevenshtein = weightedLevenshtein;
exports.normalizedDistance = normalizedDistance;
exports.jaroOrLevenshtein = jaroOrLevenshtein;
exports.canonicalizeToken = canonicalizeToken;
exports.buildVocab = buildVocab;
exports.getPoolThreshold = getPoolThreshold;
exports.getCandidatesByHeuristics = getCandidatesByHeuristics;
exports.digestForSample = digestForSample;
const fs_1 = __importDefault(require("fs"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const bktree_1 = require("./bktree");
const autolearn_1 = require("./autolearn");
const jaro_1 = __importDefault(require("./jaro"));
const SNAPSHOT_NAME = "vocab-cache.json";
const RESULTS_DIR = path_1.default.resolve(process.cwd(), "webapp/batch_ocr_out/results");
const SNAPSHOT_DIR = path_1.default.resolve(process.cwd(), "webapp/batch_ocr_out");
const SNAPSHOT_PATH = path_1.default.join(SNAPSHOT_DIR, SNAPSHOT_NAME);
const CURATED_POINTER_PATH = path_1.default.resolve(process.cwd(), "webapp/batch_ocr_out/curated-latest.json");
const CURATED_DIR = path_1.default.resolve(process.cwd(), "webapp/batch_ocr_out/curated");
const SEED_TS_PATH = path_1.default.resolve(process.cwd(), "prisma/seed.ts");
const SEED_JS_PATH = path_1.default.resolve(process.cwd(), "prisma/seed.js");
const PRODUCTS_JSON_PATH = path_1.default.resolve(process.cwd(), "data/products.json");
const HISTORY_PATH = path_1.default.resolve(process.cwd(), "webapp/batch_ocr_out/vocab-history.json");
const CONFUSION_WEIGHTS = new Map([
    ["0:o", 0.25],
    ["o:0", 0.25],
    ["1:l", 0.25],
    ["l:1", 0.25],
    ["1:i", 0.25],
    ["i:1", 0.25],
    ["rn:m", 0.25],
    ["m:rn", 0.25],
    ["5:s", 0.25],
    ["s:5", 0.25],
    ["8:b", 0.25],
    ["b:8", 0.25],
]);
const DEFAULT_THRESHOLDS = {
    brand: 0.3,
    product: 0.25,
    ingredient: 0.2,
    common: 0.2,
};
const DEFAULT_WEIGHTS = {
    distance: 0.6,
    freq: 0.25,
    avgConf: 0.15,
};
const SHORTWORD_METHOD = process.env.OCR_SHORTWORD_METHOD?.toLowerCase() ?? "jaro";
function safeJsonParse(raw) {
    try {
        return JSON.parse(raw);
    }
    catch (error) {
        console.warn(`[OCR][vocab] Failed to parse JSON: ${error?.message ?? error}`);
        return null;
    }
}
async function readJsonFileIfExists(filePath) {
    try {
        const raw = await promises_1.default.readFile(filePath, "utf-8");
        return safeJsonParse(raw);
    }
    catch (error) {
        if (error?.code !== "ENOENT") {
            console.warn(`[OCR][vocab] Failed to read ${path_1.default.relative(process.cwd(), filePath)}: ${error?.message ?? error}`);
        }
        return null;
    }
}
function normalizeWhitespace(input) {
    return input.replace(/\s+/g, " ").trim();
}
function normalizeForOcr(value = "") {
    if (typeof value !== "string")
        return "";
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
    str = normalizeWhitespace(str);
    return str;
}
function sanitizePool(pool) {
    const normalized = typeof pool === "string" ? pool.toLowerCase() : "";
    if (normalized === "brand" || normalized === "product" || normalized === "ingredient" || normalized === "common") {
        return normalized;
    }
    return "common";
}
function sanitizeCuratedEntries(source) {
    if (!Array.isArray(source))
        return [];
    const seen = new Set();
    const result = [];
    for (const item of source) {
        if (!item || typeof item !== "object")
            continue;
        const pool = sanitizePool(item.pool);
        const valueRaw = item.value;
        if (typeof valueRaw !== "string")
            continue;
        const value = normalizeWhitespace(valueRaw);
        if (!value)
            continue;
        const normalized = normalizeForOcr(value);
        if (!normalized)
            continue;
        const key = `${pool}::${normalized}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        result.push({ pool, value });
    }
    return result;
}
function sanitizeCuratedEquivalents(source) {
    if (!Array.isArray(source))
        return [];
    const result = [];
    const seen = new Set();
    for (const item of source) {
        if (!item || typeof item !== "object")
            continue;
        const canonicalRaw = item.canonical;
        const aliasesRaw = item.aliases;
        if (typeof canonicalRaw !== "string")
            continue;
        const canonical = normalizeWhitespace(canonicalRaw);
        if (!canonical)
            continue;
        const canonicalNorm = normalizeForOcr(canonical);
        if (!canonicalNorm)
            continue;
        const aliasMap = new Map();
        if (Array.isArray(aliasesRaw)) {
            for (const alias of aliasesRaw) {
                if (typeof alias !== "string")
                    continue;
                const trimmed = normalizeWhitespace(alias);
                if (!trimmed)
                    continue;
                const aliasNorm = normalizeForOcr(trimmed);
                if (!aliasNorm)
                    continue;
                if (aliasNorm === canonicalNorm)
                    continue;
                if (!aliasMap.has(aliasNorm)) {
                    aliasMap.set(aliasNorm, trimmed);
                }
            }
        }
        const key = canonicalNorm;
        if (seen.has(key)) {
            const existing = result.find((entry) => normalizeForOcr(entry.canonical) === canonicalNorm);
            if (existing) {
                const merged = new Set(existing.aliases.map((alias) => normalizeForOcr(alias)));
                for (const [aliasNorm, aliasValue] of aliasMap.entries()) {
                    if (!merged.has(aliasNorm)) {
                        existing.aliases.push(aliasValue);
                        merged.add(aliasNorm);
                    }
                }
            }
            continue;
        }
        seen.add(key);
        result.push({
            canonical,
            aliases: Array.from(aliasMap.values()),
        });
    }
    return result;
}
function isRecord(input) {
    return typeof input === "object" && input !== null;
}
function parseResultFile(data) {
    if (!isRecord(data)) {
        return { words: [], corrections: [] };
    }
    const ocrRaw = isRecord(data.ocr) ? data.ocr : null;
    const wordsRaw = Array.isArray(ocrRaw?.words) ? ocrRaw?.words : [];
    const words = wordsRaw
        .map((entry) => {
        if (isRecord(entry) && typeof entry.text === "string") {
            return { text: entry.text };
        }
        return null;
    })
        .filter((entry) => entry !== null);
    const correctionsRaw = Array.isArray(data.corrections)
        ? data.corrections
        : [];
    const corrections = correctionsRaw
        .map((entry) => {
        if (!isRecord(entry))
            return null;
        const result = {};
        if (typeof entry.text_corrected === "string") {
            result.text_corrected = entry.text_corrected;
        }
        if (typeof entry.confidence === "number") {
            result.confidence = entry.confidence;
        }
        return result;
    })
        .filter((entry) => entry !== null);
    return { words, corrections };
}
function substitutionCost(a, b) {
    if (a === b)
        return 0;
    const key = `${a}:${b}`;
    if (CONFUSION_WEIGHTS.has(key)) {
        return CONFUSION_WEIGHTS.get(key) ?? 0.25;
    }
    return 1;
}
function weightedLevenshtein(a = "", b = "") {
    const s = a || "";
    const t = b || "";
    if (s === t)
        return 0;
    if (!s.length)
        return t.length;
    if (!t.length)
        return s.length;
    const prev = new Array(t.length + 1);
    const curr = new Array(t.length + 1);
    for (let j = 0; j <= t.length; j++)
        prev[j] = j;
    for (let i = 1; i <= s.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= t.length; j++) {
            const cost = substitutionCost(s[i - 1], t[j - 1]);
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
function normalizedDistance(a, b) {
    const dist = weightedLevenshtein(a, b);
    const longest = Math.max(a.length, b.length, 1);
    return dist / longest;
}
function jaroOrLevenshtein(source, candidate) {
    if (SHORTWORD_METHOD === "levenshtein") {
        return normalizedDistance(source, candidate);
    }
    if (source.length <= 4 || candidate.length <= 4) {
        const similarity = (0, jaro_1.default)(source, candidate);
        return 1 - similarity;
    }
    return normalizedDistance(source, candidate);
}
function parseEquivalents() {
    const equivalentsPath = path_1.default.resolve(process.cwd(), "webapp/scripts/data/equivalents.json");
    try {
        const raw = fs_1.default.readFileSync(equivalentsPath, "utf-8");
        const parsed = safeJsonParse(raw);
        if (Array.isArray(parsed)) {
            return sanitizeCuratedEquivalents(parsed);
        }
    }
    catch (error) {
        if (error?.code !== "ENOENT") {
            console.warn(`[OCR][vocab] Failed to read equivalents: ${error?.message ?? error}`);
        }
    }
    return [];
}
async function loadCuratedData() {
    const fallback = {
        version: null,
        generatedAt: null,
        entries: [],
        equivalents: [],
    };
    let pointerRaw;
    try {
        pointerRaw = await promises_1.default.readFile(CURATED_POINTER_PATH, "utf-8");
    }
    catch (error) {
        if (error?.code !== "ENOENT") {
            console.warn(`[OCR][vocab] Failed to read curated pointer: ${error?.message ?? error}`);
        }
        return fallback;
    }
    const parsedPointer = safeJsonParse(pointerRaw);
    if (!parsedPointer) {
        return fallback;
    }
    const version = typeof parsedPointer.version === "string" ? parsedPointer.version : null;
    let generatedAt = typeof parsedPointer.generatedAt === "string"
        ? parsedPointer.generatedAt
        : null;
    let entries = sanitizeCuratedEntries(parsedPointer.entries);
    let equivalents = sanitizeCuratedEquivalents(parsedPointer.equivalents);
    if (version && (!entries.length && !equivalents.length)) {
        const versionPath = path_1.default.join(CURATED_DIR, version);
        try {
            const versionRaw = await promises_1.default.readFile(versionPath, "utf-8");
            const versionData = safeJsonParse(versionRaw);
            if (versionData) {
                const resolvedEntries = sanitizeCuratedEntries(versionData.entries);
                const resolvedEquivalents = sanitizeCuratedEquivalents(versionData.equivalents);
                if (resolvedEntries.length) {
                    entries = resolvedEntries;
                }
                if (resolvedEquivalents.length) {
                    equivalents = resolvedEquivalents;
                }
                const publishedAt = versionData.generatedAt ??
                    versionData.createdAt;
                if (typeof publishedAt === "string") {
                    generatedAt = publishedAt;
                }
            }
        }
        catch (error) {
            if (error?.code !== "ENOENT") {
                console.warn(`[OCR][vocab] Failed to read curated version ${version}: ${error?.message ?? error}`);
            }
        }
    }
    return {
        version,
        generatedAt,
        entries,
        equivalents,
        counts: parsedPointer.counts,
        sha256: parsedPointer.sha256 ?? null,
    };
}
function buildAliasMap(equivalents) {
    const map = new Map();
    const canonicals = new Set();
    for (const entry of equivalents) {
        const canonicalNorm = normalizeForOcr(entry.canonical);
        if (!canonicalNorm)
            continue;
        if (!map.has(canonicalNorm)) {
            map.set(canonicalNorm, entry.canonical);
        }
        canonicals.add(entry.canonical);
        for (const alias of entry.aliases) {
            const aliasNorm = normalizeForOcr(alias);
            if (!aliasNorm)
                continue;
            if (!map.has(aliasNorm)) {
                map.set(aliasNorm, entry.canonical);
            }
        }
    }
    return { map, canonicals };
}
function canonicalizeToken(token, aliasMap) {
    const normalized = normalizeForOcr(token);
    if (!normalized)
        return "";
    return aliasMap.get(normalized) ?? normalizeWhitespace(token);
}
function ensurePoolMaps() {
    return {
        brand: new Map(),
        product: new Map(),
        ingredient: new Map(),
        common: new Map(),
    };
}
function addToPool(pools, pool, token, aliasMap, stats) {
    if (!token?.trim())
        return;
    const canonical = canonicalizeToken(token, aliasMap);
    const normalized = normalizeForOcr(canonical);
    if (!normalized)
        return;
    const entry = {
        token: normalizeWhitespace(token),
        normalized,
        pool,
        canonical,
        stats,
    };
    if (!pools[pool].has(normalized)) {
        pools[pool].set(normalized, entry);
    }
    else if (stats) {
        const existing = pools[pool].get(normalized);
        if (existing) {
            const mergedStats = mergeStats(existing.stats, stats);
            pools[pool].set(normalized, { ...existing, stats: mergedStats });
        }
    }
}
function addCuratedEntries(pools, aliasMap, entries) {
    for (const entry of entries) {
        addToPool(pools, entry.pool, entry.value, aliasMap);
    }
}
function mergeStats(left, right) {
    if (!left)
        return right;
    if (!right)
        return left;
    const frequency = left.frequency + right.frequency;
    const sumConfidence = left.sumConfidence + right.sumConfidence;
    const avgConfidence = frequency
        ? sumConfidence / frequency
        : (left.avgConfidence + right.avgConfidence) / 2;
    return {
        frequency,
        sumConfidence,
        avgConfidence,
    };
}
async function loadSnapshot(pools, aliasMap) {
    const snapshot = await readJsonFileIfExists(SNAPSHOT_PATH);
    if (!snapshot)
        return;
    for (const pool of Object.keys(pools)) {
        const values = Array.isArray(snapshot[pool]) ? snapshot[pool] : [];
        for (const token of values) {
            addToPool(pools, pool, token, aliasMap);
        }
    }
}
function parseSeedFile(content) {
    const brandRegex = /brand\s*:\s*"([^"]+)"/g;
    const productRegex = /name\s*:\s*"([^"]+)"/g;
    const ingredientRegex = /\{\s*name\s*:\s*"([^"]+)"/g;
    const brands = [];
    const products = [];
    const ingredients = [];
    let match;
    while ((match = brandRegex.exec(content))) {
        brands.push(match[1]);
    }
    while ((match = productRegex.exec(content))) {
        products.push(match[1]);
    }
    while ((match = ingredientRegex.exec(content))) {
        ingredients.push(match[1]);
    }
    return { brands, products, ingredients };
}
async function loadSeedData(pools, aliasMap, useSeed) {
    if (!useSeed)
        return;
    const productsJson = await readJsonFileIfExists(PRODUCTS_JSON_PATH);
    if (productsJson) {
        for (const item of productsJson) {
            if (item?.brand)
                addToPool(pools, "brand", item.brand, aliasMap);
            if (item?.name)
                addToPool(pools, "product", item.name, aliasMap);
            if (Array.isArray(item?.ingredients)) {
                for (const ingredient of item.ingredients) {
                    addToPool(pools, "ingredient", ingredient, aliasMap);
                }
            }
        }
    }
    for (const seedPath of [SEED_TS_PATH, SEED_JS_PATH]) {
        try {
            const raw = await promises_1.default.readFile(seedPath, "utf-8");
            const parsed = parseSeedFile(raw);
            for (const brand of parsed.brands) {
                addToPool(pools, "brand", brand, aliasMap);
            }
            for (const product of parsed.products) {
                addToPool(pools, "product", product, aliasMap);
            }
            for (const ingredient of parsed.ingredients) {
                addToPool(pools, "ingredient", ingredient, aliasMap);
            }
        }
        catch (error) {
            if (error?.code !== "ENOENT") {
                console.warn(`[OCR][vocab] Failed to read ${path_1.default.relative(process.cwd(), seedPath)}: ${error?.message ?? error}`);
            }
        }
    }
}
async function loadHistoricalCorrections(pools, aliasMap) {
    try {
        const files = await promises_1.default.readdir(RESULTS_DIR);
        for (const file of files) {
            if (!file.endsWith(".json"))
                continue;
            const fullPath = path_1.default.join(RESULTS_DIR, file);
            const data = await readJsonFileIfExists(fullPath);
            if (!data)
                continue;
            const { words, corrections } = parseResultFile(data);
            for (const word of words) {
                addToPool(pools, "common", word.text, aliasMap);
            }
            for (const correction of corrections) {
                if (correction.text_corrected) {
                    addToPool(pools, "common", correction.text_corrected, aliasMap);
                }
            }
        }
    }
    catch (error) {
        if (error?.code !== "ENOENT") {
            console.warn(`[OCR][vocab] Failed to read history: ${error?.message ?? error}`);
        }
    }
}
async function loadAutoLearned(pools, aliasMap) {
    const history = await (0, autolearn_1.loadHistory)(HISTORY_PATH);
    for (const entry of history) {
        if (!entry?.normalizedTo)
            continue;
        addToPool(pools, "common", entry.normalizedTo, aliasMap);
    }
}
function mapToAllPools(pools) {
    const result = new Map();
    for (const pool of Object.keys(pools)) {
        for (const [normalized, entry] of pools[pool]) {
            if (!result.has(normalized)) {
                result.set(normalized, entry);
            }
            else {
                const existing = result.get(normalized);
                const mergedStats = mergeStats(existing.stats, entry.stats);
                result.set(normalized, { ...existing, stats: mergedStats ?? existing.stats });
            }
        }
    }
    return result;
}
function buildBkTree(all) {
    if (!process.env.OCR_USE_BKTREE)
        return null;
    const useBkTree = /^true$/i.test(process.env.OCR_USE_BKTREE);
    if (!useBkTree)
        return null;
    if (all.size <= 5000)
        return null;
    const tree = new bktree_1.BKTree(normalizedDistance);
    for (const normalized of all.keys()) {
        tree.add(normalized);
    }
    return tree;
}
function parseRankWeights() {
    const raw = process.env.OCR_RANK_WEIGHTS;
    if (!raw)
        return DEFAULT_WEIGHTS;
    const parts = raw
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((num) => Number.isFinite(num));
    if (parts.length !== 3)
        return DEFAULT_WEIGHTS;
    const [distance, freq, avgConf] = parts;
    const total = distance + freq + avgConf || 1;
    return {
        distance: distance / total,
        freq: freq / total,
        avgConf: avgConf / total,
    };
}
function summarizeHistoryStats(history) {
    const stats = new Map();
    for (const entry of history) {
        if (!entry?.normalizedTo)
            continue;
        const normalized = normalizeForOcr(entry.normalizedTo);
        if (!normalized)
            continue;
        const existing = stats.get(normalized) ?? {
            frequency: 0,
            sumConfidence: 0,
            avgConfidence: 0,
        };
        const frequency = existing.frequency + 1;
        const sumConfidence = existing.sumConfidence + entry.confidence;
        stats.set(normalized, {
            frequency,
            sumConfidence,
            avgConfidence: sumConfidence / frequency,
        });
    }
    return stats;
}
async function gatherResultStats() {
    const stats = new Map();
    try {
        const files = await promises_1.default.readdir(RESULTS_DIR);
        for (const file of files) {
            if (!file.endsWith(".json"))
                continue;
            const fullPath = path_1.default.join(RESULTS_DIR, file);
            const data = await readJsonFileIfExists(fullPath);
            if (!data)
                continue;
            const { corrections } = parseResultFile(data);
            for (const correction of corrections) {
                if (!correction.text_corrected)
                    continue;
                const normalized = normalizeForOcr(correction.text_corrected);
                if (!normalized)
                    continue;
                const conf = typeof correction.confidence === "number"
                    ? correction.confidence
                    : 0.9;
                const existing = stats.get(normalized) ?? {
                    frequency: 0,
                    sumConfidence: 0,
                    avgConfidence: 0,
                };
                const frequency = existing.frequency + 1;
                const sumConfidence = existing.sumConfidence + conf;
                stats.set(normalized, {
                    frequency,
                    sumConfidence,
                    avgConfidence: sumConfidence / frequency,
                });
            }
        }
    }
    catch (error) {
        if (error?.code !== "ENOENT") {
            console.warn(`[OCR][vocab] Failed to gather result stats: ${error?.message ?? error}`);
        }
    }
    return stats;
}
function attachStatsToPools(pools, stats) {
    for (const pool of Object.keys(pools)) {
        for (const [normalized, entry] of pools[pool]) {
            const entryStats = stats.get(normalized);
            if (entryStats) {
                pools[pool].set(normalized, { ...entry, stats: entryStats });
            }
        }
    }
}
async function writeSnapshotIfRequested(pools, writeSnapshot) {
    if (!writeSnapshot)
        return;
    try {
        await promises_1.default.mkdir(SNAPSHOT_DIR, { recursive: true });
        const payload = {};
        for (const pool of Object.keys(pools)) {
            payload[pool] = Array.from(pools[pool].values()).map((entry) => entry.canonical);
        }
        await promises_1.default.writeFile(SNAPSHOT_PATH, JSON.stringify(payload, null, 2), "utf-8");
    }
    catch (error) {
        console.warn(`[OCR][vocab] Failed to write snapshot: ${error?.message ?? error}`);
    }
}
async function buildVocab(options = {}) {
    const { useSeed = true, useHistory = true, writeSnapshot = false } = options;
    const curated = await loadCuratedData();
    const baseEquivalents = parseEquivalents();
    const combinedEquivalents = [...curated.equivalents, ...baseEquivalents];
    const { map: aliasMap, canonicals } = buildAliasMap(combinedEquivalents);
    const pools = ensurePoolMaps();
    for (const entry of curated.entries) {
        const normalized = normalizeForOcr(entry.value);
        if (normalized) {
            aliasMap.set(normalized, entry.value);
        }
    }
    addCuratedEntries(pools, aliasMap, curated.entries);
    for (const canonical of canonicals) {
        addToPool(pools, "common", canonical, aliasMap);
    }
    await loadSnapshot(pools, aliasMap);
    await loadSeedData(pools, aliasMap, useSeed);
    if (useHistory) {
        await loadHistoricalCorrections(pools, aliasMap);
    }
    await loadAutoLearned(pools, aliasMap);
    const resultStats = await gatherResultStats();
    const historyStats = summarizeHistoryStats(await (0, autolearn_1.loadHistory)(HISTORY_PATH));
    for (const [key, stat] of historyStats.entries()) {
        const existing = resultStats.get(key);
        resultStats.set(key, mergeStats(existing, stat) ?? stat);
    }
    attachStatsToPools(pools, resultStats);
    await writeSnapshotIfRequested(pools, writeSnapshot);
    const all = mapToAllPools(pools);
    const bkTree = buildBkTree(all);
    const weights = parseRankWeights();
    return {
        pools,
        aliasToCanonical: aliasMap,
        all,
        bkTree,
        weights,
    };
}
function scoreCandidate(normalizedQuery, entry, weights) {
    const distance = jaroOrLevenshtein(normalizedQuery, entry.normalized);
    const stats = entry.stats ?? {
        frequency: 0,
        sumConfidence: 0,
        avgConfidence: 0.5,
    };
    const freqNorm = Math.min(1, Math.log10(stats.frequency + 1) / 3);
    const avgConfNorm = Math.max(0, Math.min(1, stats.avgConfidence));
    const distanceScore = 1 - distance;
    const score = weights.distance * distanceScore +
        weights.freq * freqNorm +
        weights.avgConf * avgConfNorm;
    return {
        ...entry,
        distance,
        relDistance: distance,
        score,
    };
}
function getPoolThreshold(pool) {
    const key = `OCR_POOL_THRESH_${pool.toUpperCase()}`;
    const raw = process.env[key];
    const fallback = DEFAULT_THRESHOLDS[pool.toLowerCase() ?? "common"] ?? 0.25;
    if (!raw)
        return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed))
        return fallback;
    return parsed;
}
function getCandidatesByHeuristics(input, vocabulary, options = {}) {
    const { pools = ["brand", "product", "ingredient", "common"], limit = 50 } = options;
    if (!input?.trim())
        return [];
    const normalizedQuery = normalizeForOcr(input);
    if (!normalizedQuery)
        return [];
    const seen = new Map();
    const hits = [];
    const considerEntry = (entry) => {
        if (!entry)
            return;
        const scored = scoreCandidate(normalizedQuery, entry, vocabulary.weights);
        const existing = seen.get(entry.normalized);
        if (!existing || scored.score > existing.score) {
            seen.set(entry.normalized, scored);
        }
    };
    for (const pool of pools) {
        const poolMap = vocabulary.pools[pool];
        if (!poolMap)
            continue;
        for (const entry of poolMap.values()) {
            considerEntry(entry);
        }
    }
    if (options.useBkTree && vocabulary.bkTree) {
        const threshold = options.threshold ??
            Math.max(...pools.map((pool) => getPoolThreshold(pool)), 0.25);
        const bkHits = vocabulary.bkTree.search(normalizedQuery, threshold);
        for (const hit of bkHits) {
            const entry = vocabulary.all.get(hit.value);
            if (entry)
                considerEntry(entry);
        }
    }
    for (const candidate of seen.values()) {
        hits.push(candidate);
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
}
function digestForSample(values) {
    return crypto_1.default
        .createHash("sha1")
        .update(values.join("::"))
        .digest("hex");
}
