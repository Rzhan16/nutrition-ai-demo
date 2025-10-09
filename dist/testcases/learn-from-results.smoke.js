"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("assert/strict"));
const promises_1 = __importDefault(require("fs/promises"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const learn_from_results_1 = require("../learn-from-results");
async function createSampleResult(resultsDir, fileName, words) {
    const payload = {
        ocr: {
            words,
        },
    };
    const targetPath = path_1.default.join(resultsDir, fileName);
    await promises_1.default.writeFile(targetPath, JSON.stringify(payload, null, 2), "utf-8");
}
async function main() {
    const tmpRoot = await promises_1.default.mkdtemp(path_1.default.join(os_1.default.tmpdir(), "auto-learn-smoke-"));
    const batchDir = path_1.default.join(tmpRoot, "batch_ocr_out");
    const resultsDir = path_1.default.join(batchDir, "results");
    await promises_1.default.mkdir(resultsDir, { recursive: true });
    const historyPath = path_1.default.join(batchDir, "vocab-history.json");
    const highConfidenceWords = [
        { text: "Nordic Naturals", confidence: 0.96, line_id: 0, block_id: 0 },
        { text: "Omega-3", confidence: 0.95, line_id: 1, block_id: 0 },
        { text: "Omega-3", confidence: 0.97, line_id: 2, block_id: 0 },
        { text: "Mock Capsule", confidence: 0.92, line_id: 4, block_id: 1 },
    ];
    const secondFileWords = [
        { text: "Nordic Naturals", confidence: 0.94, line_id: 0, block_id: 0 },
        { text: "Omega-3", confidence: 0.96, line_id: 1, block_id: 0 },
        { text: "Softgels", confidence: 0.91, line_id: 4, block_id: 1 },
    ];
    const thirdFileWords = [
        { text: "Herbal Balance", confidence: 0.93, line_id: 0, block_id: 0 },
        { text: "Herbal Balance", confidence: 0.92, line_id: 1, block_id: 0 },
        { text: "Vitamin Blend", confidence: 0.88, line_id: 2, block_id: 0 },
    ];
    await createSampleResult(resultsDir, "result-1.json", highConfidenceWords);
    await createSampleResult(resultsDir, "result-2.json", secondFileWords);
    await createSampleResult(resultsDir, "result-3.json", thirdFileWords);
    // Ensure files are within lookback window.
    const now = Date.now();
    for (const file of await promises_1.default.readdir(resultsDir)) {
        const filePath = path_1.default.join(resultsDir, file);
        await promises_1.default.utimes(filePath, now / 1000, now / 1000);
    }
    process.env.AUTOLEARN_BASE_DIR = batchDir;
    process.env.OCR_HISTORY_PATH = historyPath;
    process.env.AUTOLEARN_LOOKBACK_DAYS = "30";
    process.env.AUTOLEARN_MIN_CONF = "0.9";
    process.env.AUTOLEARN_MIN_OCCURRENCES = "2";
    process.env.AUTOLEARN_SHADOW_PREVIEW = "false";
    await (0, learn_from_results_1.learnFromResults)({ baseDir: batchDir });
    const historyRawFirst = await promises_1.default.readFile(historyPath, "utf-8");
    const historyFirst = JSON.parse(historyRawFirst);
    (0, strict_1.default)(Array.isArray(historyFirst), "History should be an array.");
    const firstLength = historyFirst.length;
    (0, strict_1.default)(firstLength > 0, "Auto-learn should append new entries on first run.");
    await (0, learn_from_results_1.learnFromResults)({ baseDir: batchDir });
    const historyRawSecond = await promises_1.default.readFile(historyPath, "utf-8");
    const historySecond = JSON.parse(historyRawSecond);
    (0, strict_1.default)(Array.isArray(historySecond), "History should remain an array.");
    strict_1.default.strictEqual(historySecond.length, firstLength, "Second run should not duplicate existing entries.");
    console.log("Auto-learn smoke test passed.");
}
main().catch((error) => {
    console.error("Auto-learn smoke test failed:", error);
    process.exitCode = 1;
});
