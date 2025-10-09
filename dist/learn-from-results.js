"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.learnFromResults = learnFromResults;
const fs_1 = __importDefault(require("fs"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const autolearn_1 = require("./utils/autolearn");
const vocab_1 = require("./utils/vocab");
const PROTECTED_LITERALS = [
    "mg",
    "mcg",
    "g",
    "iu",
    "ml",
    "l",
    "epa",
    "dha",
    "coq10",
    "k2",
    "d3",
    "b12",
    "zinc",
    "vitamin",
    "facts",
    "serving",
    "capsules",
    "softgels",
];
const PROTECTED_UNITS_RE = /^\d+(?:\.\d+)?\s*(mg|mcg|g|iu|ml|l|oz|%|mcgs?)$/i;
const DEFAULT_BASE_DIR = path_1.default.resolve(process.cwd(), "webapp/batch_ocr_out");
async function learnFromResults(options = {}) {
    const now = options.now ?? new Date();
    const baseDir = options.baseDir ??
        process.env.AUTOLEARN_BASE_DIR ??
        DEFAULT_BASE_DIR;
    const resolvedBaseDir = path_1.default.resolve(baseDir);
    const resultsDir = process.env.AUTOLEARN_RESULTS_DIR ??
        path_1.default.join(resolvedBaseDir, "results");
    const resolvedResultsDir = path_1.default.resolve(resultsDir);
    const minConfidence = Number(process.env.AUTOLEARN_MIN_CONF ?? "0.9");
    const minOccurrences = Math.max(1, Number(process.env.AUTOLEARN_MIN_OCCURRENCES ?? "2"));
    const lookbackDays = Math.max(1, Number(process.env.AUTOLEARN_LOOKBACK_DAYS ?? "7"));
    const shadowPreview = options.shadowPreview ??
        /^true$/i.test(process.env.AUTOLEARN_SHADOW_PREVIEW ?? "false");
    const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
    const thresholdTime = new Date(now.getTime() - lookbackMs);
    const normalizedProtected = new Set(PROTECTED_LITERALS.map((literal) => (0, vocab_1.normalizeForOcr)(literal)));
    const aggregated = new Map();
    const processedFiles = [];
    let earliest = null;
    let latest = null;
    if (!fs_1.default.existsSync(resolvedResultsDir)) {
        console.warn(`[AUTOLEARN] Results directory not found: ${resolvedResultsDir}`);
        return;
    }
    const entries = await promises_1.default.readdir(resolvedResultsDir);
    for (const entry of entries) {
        if (!entry.endsWith(".json"))
            continue;
        const fullPath = path_1.default.join(resolvedResultsDir, entry);
        let stat;
        try {
            stat = await promises_1.default.stat(fullPath);
        }
        catch {
            continue;
        }
        if (stat.mtime < thresholdTime) {
            continue;
        }
        earliest = earliest ? new Date(Math.min(earliest.getTime(), stat.mtime.getTime())) : stat.mtime;
        latest = latest ? new Date(Math.max(latest.getTime(), stat.mtime.getTime())) : stat.mtime;
        let parsed;
        try {
            const raw = await promises_1.default.readFile(fullPath, "utf-8");
            parsed = JSON.parse(raw);
        }
        catch (error) {
            console.warn(`[AUTOLEARN] Failed to parse ${entry}: ${error.message}`);
            continue;
        }
        processedFiles.push(entry);
        const words = Array.isArray(parsed?.ocr?.words)
            ? parsed.ocr.words
            : [];
        for (const word of words) {
            const rawText = word?.text;
            if (typeof rawText !== "string")
                continue;
            const confidence = Number(word?.confidence ?? 0);
            if (!Number.isFinite(confidence) || confidence < minConfidence) {
                continue;
            }
            if (PROTECTED_UNITS_RE.test(rawText))
                continue;
            const normalized = (0, vocab_1.normalizeForOcr)(rawText);
            if (!normalized)
                continue;
            if (normalizedProtected.has(normalized))
                continue;
            if (normalized.length <= 1)
                continue;
            const pool = inferPool(word, normalized);
            const key = `${pool}::${normalized}`;
            const record = aggregated.get(key);
            if (record) {
                record.count += 1;
                record.sumConfidence += confidence;
                record.samples.add(rawText);
            }
            else {
                aggregated.set(key, {
                    normalized,
                    pool,
                    count: 1,
                    sumConfidence: confidence,
                    samples: new Set([rawText]),
                });
            }
        }
    }
    if (aggregated.size === 0) {
        console.log(`[AUTOLEARN] No qualifying tokens in the last ${lookbackDays} day(s).`);
        return;
    }
    const existingHistory = await (0, autolearn_1.loadHistory)(process.env.OCR_HISTORY_PATH);
    const existingKeys = new Set(existingHistory.map((record) => `${record.pool ?? "common"}::${(0, vocab_1.normalizeForOcr)(record.normalizedTo)}`));
    const learned = [];
    let skippedLowOccurrence = 0;
    for (const stat of aggregated.values()) {
        if (stat.count < minOccurrences) {
            skippedLowOccurrence += 1;
            continue;
        }
        const historyKey = `${stat.pool}::${stat.normalized}`;
        if (existingKeys.has(historyKey)) {
            continue;
        }
        learned.push(stat);
        existingKeys.add(historyKey);
    }
    if (learned.length === 0) {
        console.log(`[AUTOLEARN] No new tokens exceeded occurrence threshold (${minOccurrences}).`);
    }
    if (!shadowPreview) {
        for (const token of learned) {
            const sample = token.samples.values().next().value ?? token.normalized;
            const averageConfidence = token.sumConfidence / token.count;
            await (0, autolearn_1.updateHistory)({
                learnedFrom: sample,
                normalizedTo: token.normalized,
                confidence: averageConfidence,
                pool: token.pool,
                digest: (0, vocab_1.digestForSample)([
                    token.normalized,
                    token.pool,
                    token.count.toString(),
                ]),
            });
        }
    }
    const rangeStart = earliest ? earliest.toISOString() : "n/a";
    const rangeEnd = latest ? latest.toISOString() : "n/a";
    console.log(`[AUTOLEARN] learned=${learned.length} shadow=${shadowPreview} skipped_low_occ=${skippedLowOccurrence} files=${processedFiles.length} range=${rangeStart}..${rangeEnd}`);
    if (shadowPreview && learned.length > 0) {
        const preview = learned
            .slice(0, 10)
            .map((token) => `${token.normalized} [${token.pool}] x${token.count} avg=${token.sumConfidence / token.count}`);
        console.log("[AUTOLEARN] Preview:", preview);
    }
}
function inferPool(word, normalized) {
    const text = word?.text ?? "";
    const hasDigits = /\d/.test(text);
    const hasUnit = /(mg|mcg|g|iu|ml|l|oz|\b%|\bmcgs?)/i.test(text) || /\d%/.test(text);
    const blockId = typeof word?.block_id === "number" ? word.block_id : 999;
    const lineId = typeof word?.line_id === "number" ? word.line_id : 999;
    if (hasDigits || hasUnit) {
        return "ingredient";
    }
    if (blockId <= 0 || lineId <= 1) {
        return "brand";
    }
    if (lineId <= 3) {
        return "product";
    }
    if (normalized.length <= 3) {
        return "common";
    }
    return "common";
}
if (require.main === module) {
    learnFromResults().catch((error) => {
        console.error("[AUTOLEARN] Fatal error:", error);
        process.exitCode = 1;
    });
}
