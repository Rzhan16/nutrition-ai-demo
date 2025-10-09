"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadHistory = loadHistory;
exports.updateHistory = updateHistory;
const fs_1 = __importDefault(require("fs"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const DEFAULT_HISTORY_PATH = path_1.default.resolve(process.cwd(), "webapp/batch_ocr_out/vocab-history.json");
const CAPACITY = 5000;
function getHistoryPath(customPath) {
    const envPath = process.env.OCR_HISTORY_PATH;
    const provided = customPath?.trim();
    return path_1.default.resolve(process.cwd(), provided || envPath || DEFAULT_HISTORY_PATH);
}
function dedupeRecords(records) {
    const seen = new Map();
    for (const record of records) {
        if (!record?.normalizedTo || !record?.learnedFrom)
            continue;
        const key = `${record.normalizedTo}::${record.learnedFrom}`;
        seen.set(key, record);
    }
    return Array.from(seen.values());
}
function clampSize(records) {
    if (records.length <= CAPACITY)
        return records;
    const sorted = [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return sorted.slice(sorted.length - CAPACITY);
}
async function loadHistory(pathOverride) {
    const historyPath = getHistoryPath(pathOverride);
    try {
        const raw = await promises_1.default.readFile(historyPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        const sanitized = parsed
            .filter((entry) => !!entry &&
            typeof entry.learnedFrom === "string" &&
            typeof entry.normalizedTo === "string" &&
            typeof entry.confidence === "number")
            .map((entry) => ({
            learnedFrom: entry.learnedFrom,
            normalizedTo: entry.normalizedTo,
            confidence: entry.confidence,
            pool: entry.pool,
            digest: entry.digest,
            timestamp: entry.timestamp ?? new Date().toISOString(),
        }));
        return clampSize(dedupeRecords(sanitized));
    }
    catch (error) {
        if (error?.code === "ENOENT") {
            return [];
        }
        console.warn(`[OCR][autolearn] Failed to load history (${historyPath}): ${error?.message ?? error}`);
        return [];
    }
}
async function writeHistoryAtomic(historyPath, records) {
    const dir = path_1.default.dirname(historyPath);
    await promises_1.default.mkdir(dir, { recursive: true });
    const payload = JSON.stringify(records, null, 2);
    const tmpPath = path_1.default.join(dir, `${path_1.default.basename(historyPath)}.tmp-${process.pid}-${Date.now()}`);
    await promises_1.default.writeFile(tmpPath, payload, "utf-8");
    await promises_1.default.rename(tmpPath, historyPath);
}
async function updateHistory(params) {
    const { learnedFrom, normalizedTo, confidence, pool, digest, historyPath } = params;
    if (!learnedFrom || !normalizedTo || !Number.isFinite(confidence)) {
        return;
    }
    const pathToUse = getHistoryPath(historyPath);
    const record = {
        learnedFrom,
        normalizedTo,
        confidence,
        pool,
        digest,
        timestamp: new Date().toISOString(),
    };
    const existing = await loadHistory(pathToUse);
    const combined = clampSize(dedupeRecords([...existing, record]));
    try {
        await writeHistoryAtomic(pathToUse, combined);
    }
    catch (error) {
        console.warn(`[OCR][autolearn] Failed to write history (${pathToUse}): ${error?.message ?? error}`);
        try {
            if (fs_1.default.existsSync(pathToUse)) {
                await writeHistoryAtomic(pathToUse, existing);
            }
        }
        catch {
            /* swallow secondary failure */
        }
    }
}
