"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickCandidatePoolsForSpan = pickCandidatePoolsForSpan;
const fs_1 = __importDefault(require("fs"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const vocab_1 = require("./utils/vocab");
const autolearn_1 = require("./utils/autolearn");
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
const PROTECTED_TOKENS = new Set(PROTECTED_LITERALS.map((token) => (0, vocab_1.normalizeForOcr)(token)));
const PROTECTED_UNITS_RE = /^(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu)$/i;
const SUMMARY_PATH = path_1.default.resolve(process.cwd(), "webapp/batch_ocr_out/summary/metrics.json");
const AGGREGATE = {
    correctionsApplied: 0,
    correctionsSuggested: 0,
    unitTouches: 0,
    riskyPatterns: new Map(),
    dedupe: new Set(),
};
const bool = (value, fallback) => {
    if (value == null)
        return fallback;
    return /^true$/i.test(value);
};
const num = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const OCR_AUTO_LEARN = bool(process.env.OCR_AUTO_LEARN, true);
const OCR_USE_BKTREE = bool(process.env.OCR_USE_BKTREE, false);
const OCR_POST_CORRECT_MODE = process.env.OCR_POST_CORRECT_MODE?.toLowerCase() ??
    "on";
const OCR_POST_CORRECT_RATIO = Math.max(0, Math.min(1, num(process.env.OCR_POST_CORRECT_RATIO, 1)));
const OCR_HISTORY_PATH = process.env.OCR_HISTORY_PATH ??
    path_1.default.resolve(process.cwd(), "webapp/batch_ocr_out/vocab-history.json");
function loadPhraseTemplates() {
    const filePath = path_1.default.resolve(process.cwd(), "webapp/scripts/data/phrases.json");
    try {
        const raw = fs_1.default.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .filter((value) => typeof value === "string")
                .map((value) => value.toLowerCase());
        }
    }
    catch (error) {
        if (error?.code !== "ENOENT") {
            console.warn(`[OCR][batch] Failed to load phrase templates: ${error?.message ?? error}`);
        }
    }
    return [];
}
function computeLayoutStats(words) {
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const word of words) {
        const bbox = word?.bbox;
        const top = typeof word?.y === "number" ? word.y : bbox?.[1];
        const bottom = bbox && typeof bbox[3] === "number" ? bbox[3] : typeof word?.y === "number"
            ? word.y
            : undefined;
        if (typeof top === "number")
            minY = Math.min(minY, top);
        if (typeof bottom === "number")
            maxY = Math.max(maxY, bottom);
    }
    if (!Number.isFinite(minY))
        minY = 0;
    if (!Number.isFinite(maxY))
        maxY = minY + 1;
    if (maxY <= minY)
        maxY = minY + 1;
    return { minY, maxY };
}
function relativeY(word, stats) {
    const bbox = word?.bbox;
    const center = bbox && typeof bbox[1] === "number" && typeof bbox[3] === "number"
        ? (bbox[1] + bbox[3]) / 2
        : typeof word?.y === "number"
            ? word.y
            : stats.minY;
    const ratio = (center - stats.minY) / (stats.maxY - stats.minY);
    return Math.max(0, Math.min(1, ratio));
}
function looksLikeTable(word) {
    const text = word?.text || "";
    const digits = text.replace(/[^0-9]/g, "").length;
    const alpha = text.replace(/[^a-z]/gi, "").length;
    return digits > alpha;
}
function pickCandidatePoolsForSpan(word, stats) {
    const ratio = relativeY(word, stats);
    const tableLike = looksLikeTable(word);
    if (ratio <= 0.25) {
        return ["brand", "product", "common"];
    }
    if (ratio <= 0.7 && !tableLike) {
        return ["product", "common", "ingredient"];
    }
    return ["ingredient", "common", "product"];
}
function shouldSkipToken(normalized, original) {
    if (!normalized)
        return true;
    if (PROTECTED_TOKENS.has(normalized))
        return true;
    if (PROTECTED_UNITS_RE.test(original))
        return true;
    if (/^[\d\W_]+$/.test(original))
        return true;
    return false;
}
function hashToUnitInterval(hash) {
    const slice = hash.slice(0, 8);
    const int = parseInt(slice, 16);
    return int / 0xffffffff;
}
function shouldApplySample(digest) {
    if (OCR_POST_CORRECT_MODE !== "on")
        return false;
    if (OCR_POST_CORRECT_RATIO >= 1)
        return true;
    const value = hashToUnitInterval(digest);
    return value <= OCR_POST_CORRECT_RATIO;
}
function recordMetrics(audit, numericTouched) {
    const key = `${audit.digest ?? "?"}::${audit.line_id ?? "?"}::${audit.text_original ?? ""}`;
    if (AGGREGATE.dedupe.has(key))
        return;
    AGGREGATE.dedupe.add(key);
    AGGREGATE.correctionsSuggested += 1;
    if (audit.applied) {
        AGGREGATE.correctionsApplied += 1;
    }
    if (numericTouched) {
        AGGREGATE.unitTouches += 1;
        const bucket = audit.text_original?.toLowerCase() ?? "(unknown)";
        AGGREGATE.riskyPatterns.set(bucket, (AGGREGATE.riskyPatterns.get(bucket) || 0) + 1);
    }
}
async function flushMetrics() {
    const payload = {
        corrections_applied: AGGREGATE.correctionsApplied,
        corrections_suggested: AGGREGATE.correctionsSuggested,
        unit_error_rate: AGGREGATE.correctionsApplied === 0
            ? 0
            : AGGREGATE.unitTouches / AGGREGATE.correctionsApplied,
        top_risky_patterns: Array.from(AGGREGATE.riskyPatterns.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([pattern, count]) => ({ pattern, count })),
        precision_est: await readPrecisionPlaceholder(),
        generated_at: new Date().toISOString(),
    };
    await writeJsonAtomic(SUMMARY_PATH, payload);
}
async function readPrecisionPlaceholder() {
    const filePath = path_1.default.resolve(process.cwd(), "webapp/batch_ocr_out/gold-metrics.json");
    try {
        const raw = await promises_1.default.readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        const value = Number(parsed?.precision_est);
        if (Number.isFinite(value)) {
            return value;
        }
    }
    catch (error) {
        if (error?.code !== "ENOENT") {
            console.warn(`[OCR][batch] Failed to read precision placeholder: ${error?.message ?? error}`);
        }
    }
    return null;
}
async function writeJsonAtomic(filePath, data) {
    const dir = path_1.default.dirname(filePath);
    await promises_1.default.mkdir(dir, { recursive: true });
    const payload = JSON.stringify(data, null, 2);
    const tempPath = path_1.default.join(dir, `${path_1.default.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
    await promises_1.default.writeFile(tempPath, payload, "utf-8");
    await promises_1.default.rename(tempPath, filePath);
}
function applyPhraseTemplates(words, phrases) {
    const locked = new Set();
    if (!phrases.length)
        return locked;
    const normalizedWords = words.map((word) => (0, vocab_1.normalizeForOcr)(word.text));
    const phraseTokens = phrases.map((phrase) => ({
        phrase,
        normalized: (0, vocab_1.normalizeForOcr)(phrase),
        length: (0, vocab_1.normalizeForOcr)(phrase).split(" ").length,
    }));
    for (const { phrase, normalized, length } of phraseTokens) {
        if (!length)
            continue;
        for (let i = 0; i <= normalizedWords.length - length; i++) {
            if (locked.has(i))
                continue;
            const spanTextNormalized = (0, vocab_1.normalizeForOcr)(words
                .slice(i, i + length)
                .map((word) => word.text)
                .join(" "));
            const charSetSpan = new Set(spanTextNormalized.replace(/\s+/g, "").split(""));
            const charSetPhrase = new Set(normalized.replace(/\s+/g, "").split(""));
            const unionSize = new Set([
                ...Array.from(charSetSpan),
                ...Array.from(charSetPhrase),
            ]).size;
            const intersectionSize = Array.from(charSetSpan).filter((ch) => charSetPhrase.has(ch)).length;
            const jaccard = unionSize === 0 ? 0 : intersectionSize / unionSize;
            const spanText = (0, vocab_1.normalizeForOcr)(words
                .slice(i, i + length)
                .map((word) => word.text)
                .join(" "));
            const similarity = 1 - (0, vocab_1.normalizedDistance)(spanText, normalized);
            if (jaccard >= 0.5 && similarity >= 0.78) {
                const phraseWords = phrase.split(" ");
                for (let j = 0; j < length; j++) {
                    const idx = i + j;
                    const replacement = phraseWords[j] ?? phraseWords[phraseWords.length - 1];
                    words[idx].text = replacement;
                    words[idx].locked = true;
                    locked.add(idx);
                }
            }
        }
    }
    return locked;
}
function selectBestCandidate(original, candidates, pools) {
    if (!candidates.length)
        return undefined;
    const normalizedOriginal = (0, vocab_1.normalizeForOcr)(original);
    let best;
    for (const candidate of candidates) {
        const threshold = (0, vocab_1.getPoolThreshold)(candidate.pool);
        const distance = candidate.relDistance ?? candidate.distance;
        if (distance > threshold)
            continue;
        if (candidate.normalized === normalizedOriginal)
            continue;
        if (!best ||
            candidate.score > best.score ||
            (candidate.score === best.score &&
                (candidate.distance ?? 1) < (best.distance ?? 1))) {
            best = candidate;
        }
    }
    if (!best && pools.length) {
        // fallback to best per primary pool threshold
        const primary = pools[0];
        best = candidates
            .filter((candidate) => candidate.pool === primary)
            .sort((a, b) => b.score - a.score)[0];
    }
    return best;
}
function createAuditEntry(params) {
    const { original, candidate, word, context, digest, applied, mode, reason } = params;
    const corrected = candidate?.canonical ?? candidate?.token ?? null;
    const distance = candidate?.distance ?? null;
    const relDistance = candidate?.relDistance ?? null;
    return {
        text_original: original,
        text_corrected: corrected && corrected !== original ? corrected : null,
        distance,
        rel_distance: relDistance,
        pool: candidate?.pool,
        confidence: Number(Number(word.confidence ?? 0).toFixed(4)),
        brand_context: context?.brand ?? null,
        product_context: context?.product ?? null,
        block_id: word.block_id ?? null,
        line_id: word.line_id ?? null,
        digest,
        applied,
        mode,
        reason,
    };
}
async function applyCorrection(word, options) {
    const { vocabulary, context, docDigest, phrasesLocked, index, layoutStats, } = options;
    const original = word.text ?? "";
    const normalized = (0, vocab_1.normalizeForOcr)(original);
    if (phrasesLocked.has(index))
        return null;
    if (shouldSkipToken(normalized, original))
        return null;
    const pools = pickCandidatePoolsForSpan(word, layoutStats);
    const candidates = (0, vocab_1.getCandidatesByHeuristics)(original, vocabulary, {
        pools,
        limit: 50,
        useBkTree: OCR_USE_BKTREE,
    });
    const best = selectBestCandidate(original, candidates, pools);
    const digest = (0, vocab_1.digestForSample)([
        docDigest,
        String(word.line_id ?? index),
        original,
    ]);
    let applied = false;
    let reason;
    if (!best) {
        reason = "no_candidate";
    }
    else if (OCR_POST_CORRECT_MODE === "off") {
        applied = false;
        reason = "mode_off";
    }
    else if (OCR_POST_CORRECT_MODE === "shadow") {
        applied = false;
        reason = "shadow_mode";
    }
    else if (!shouldApplySample(digest)) {
        applied = false;
        reason = "sample_filtered";
    }
    else {
        applied = true;
        word.text = best.canonical;
    }
    const audit = createAuditEntry({
        original,
        candidate: best,
        word,
        context,
        digest,
        applied,
        mode: OCR_POST_CORRECT_MODE,
        reason,
    });
    const numericTouched = PROTECTED_UNITS_RE.test(original);
    recordMetrics(audit, numericTouched);
    if (applied &&
        OCR_AUTO_LEARN &&
        !numericTouched &&
        !PROTECTED_TOKENS.has(normalized)) {
        await (0, autolearn_1.updateHistory)({
            learnedFrom: original,
            normalizedTo: best?.canonical ?? best?.token ?? original,
            confidence: Number(word.confidence ?? 0),
            pool: best?.pool,
            digest,
            historyPath: OCR_HISTORY_PATH,
        });
    }
    return audit;
}
async function processOcrPayload(payload, vocabulary, phrases) {
    const words = Array.isArray(payload?.ocr?.words)
        ? payload.ocr.words
        : [];
    const layoutStats = computeLayoutStats(words);
    const locked = applyPhraseTemplates(words, phrases);
    const docDigest = (0, vocab_1.digestForSample)([
        payload.imgPath ?? payload.imgUrl ?? "unknown",
        payload.item?.brand ?? "",
        payload.item?.product ?? "",
    ]);
    const audits = [];
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        word.locked = word.locked || locked.has(i);
        if (word.locked) {
            audits.push(createAuditEntry({
                original: word.text,
                candidate: undefined,
                word,
                context: payload.item,
                digest: docDigest,
                applied: false,
                mode: OCR_POST_CORRECT_MODE,
                reason: "phrase_locked",
            }));
            continue;
        }
        const audit = await applyCorrection(word, {
            vocabulary,
            context: payload.item,
            docDigest,
            phrasesLocked: locked,
            index: i,
            layoutStats,
        });
        if (audit) {
            audits.push(audit);
        }
    }
    return {
        ...payload,
        ocr: { words },
        corrections: audits,
        meta: {
            ...(payload.meta ?? {}),
            OCR_POST_CORRECT_MODE,
            OCR_POST_CORRECT_RATIO,
            OCR_AUTO_LEARN,
        },
    };
}
async function loadOcrFile(filePath) {
    try {
        const raw = await promises_1.default.readFile(filePath, "utf-8");
        return JSON.parse(raw);
    }
    catch (error) {
        console.warn(`[OCR][batch] Failed to read ${path_1.default.relative(process.cwd(), filePath)}: ${error?.message ?? error}`);
        return null;
    }
}
async function processFile(filePath, vocabulary, phrases) {
    const payload = await loadOcrFile(filePath);
    if (!payload)
        return;
    const processed = await processOcrPayload(payload, vocabulary, phrases);
    await writeJsonAtomic(filePath, processed);
}
async function processDirectory(dirPath, vocabulary, phrases) {
    const exists = fs_1.default.existsSync(dirPath);
    if (!exists)
        return;
    const files = await promises_1.default.readdir(dirPath);
    for (const file of files) {
        if (!file.endsWith(".json"))
            continue;
        await processFile(path_1.default.join(dirPath, file), vocabulary, phrases);
    }
}
async function processSamples(vocabulary, phrases) {
    const samplesDir = path_1.default.resolve(process.cwd(), "webapp/scripts/testcases/samples");
    await processDirectory(samplesDir, vocabulary, phrases);
}
async function main() {
    const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
    const mode = modeArg ? modeArg.split("=")[1] : "batch";
    const phrases = loadPhraseTemplates();
    const vocabulary = await (0, vocab_1.buildVocab)({
        useSeed: true,
        useHistory: true,
        writeSnapshot: false,
    });
    if (mode === "test") {
        await processSamples(vocabulary, phrases);
    }
    else if (mode === "file") {
        const targetArg = process.argv.find((arg) => arg.startsWith("--file="));
        if (!targetArg) {
            console.error("Missing --file=path when using --mode=file");
            return;
        }
        const filePath = path_1.default.resolve(process.cwd(), targetArg.split("=")[1]);
        await processFile(filePath, vocabulary, phrases);
    }
    else {
        const resultsDir = path_1.default.resolve(process.cwd(), "webapp/batch_ocr_out/results");
        await processDirectory(resultsDir, vocabulary, phrases);
    }
    await flushMetrics();
}
main().catch((error) => {
    console.error("[OCR][batch] Fatal error:", error);
    process.exitCode = 1;
});
