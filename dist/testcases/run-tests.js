"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
async function ensureDir(dir) {
    await promises_1.default.mkdir(dir, { recursive: true });
}
async function copyFixture(fileName, targetDir) {
    const source = path_1.default.resolve(process.cwd(), "webapp/scripts/testcases/samples", fileName);
    const target = path_1.default.join(targetDir, fileName);
    await promises_1.default.copyFile(source, target);
    return target;
}
function runBatchOcr(filePath, env) {
    const result = (0, child_process_1.spawnSync)(process.execPath, [
        path_1.default.resolve(process.cwd(), "dist/batch-ocr.js"),
        "--mode=file",
        `--file=${filePath}`,
    ], {
        env: {
            ...process.env,
            ...env,
        },
        stdio: "inherit",
    });
    if (result.status !== 0) {
        throw new Error(`OCR batch script failed for ${filePath}`);
    }
}
async function readJson(filePath) {
    const raw = await promises_1.default.readFile(filePath, "utf-8");
    return JSON.parse(raw);
}
async function runPhraseTest(tmpDir, historyPath) {
    const file = await copyFixture("phrase.json", tmpDir);
    runBatchOcr(file, {
        OCR_POST_CORRECT_MODE: "on",
        OCR_POST_CORRECT_RATIO: "1",
        OCR_AUTO_LEARN: "false",
        OCR_HISTORY_PATH: historyPath,
    });
    const data = await readJson(file);
    const words = data.ocr?.words ?? [];
    const first = words[0]?.text;
    const second = words[1]?.text;
    if (first !== "dietary" || second !== "supplement") {
        throw new Error(`Phrase test failed: expected 'dietary supplement', received '${first} ${second}'`);
    }
    console.log("✓ Phrase template correction applied");
}
async function runShortwordTest(tmpDir, historyPath) {
    const file = await copyFixture("shortword.json", tmpDir);
    runBatchOcr(file, {
        OCR_POST_CORRECT_MODE: "on",
        OCR_POST_CORRECT_RATIO: "1",
        OCR_AUTO_LEARN: "false",
        OCR_HISTORY_PATH: historyPath,
    });
    const data = await readJson(file);
    const texts = (data.ocr?.words ?? [])
        .map((word) => word.text)
        .filter((value) => typeof value === "string");
    if (!texts.includes("mg") || !texts.includes("d3")) {
        throw new Error(`Shortword test failed: tokens mutated unexpectedly (${texts.join(", ")})`);
    }
    console.log("✓ Shortword protection validated");
}
async function runShadowModeTest(tmpDir, historyPath) {
    const file = await copyFixture("shadow.json", tmpDir);
    runBatchOcr(file, {
        OCR_POST_CORRECT_MODE: "shadow",
        OCR_POST_CORRECT_RATIO: "1",
        OCR_AUTO_LEARN: "false",
        OCR_HISTORY_PATH: historyPath,
    });
    const data = await readJson(file);
    const original = data.ocr?.words?.[0]?.text;
    const corrections = data.corrections ?? [];
    if (original !== "vitamln") {
        throw new Error(`Shadow test failed: expected raw token to remain 'vitamln', received '${original}'`);
    }
    const suggestion = corrections.find((entry) => entry.text_corrected === "vitamin");
    if (!suggestion) {
        throw new Error("Shadow test failed: expected suggestion for 'vitamln' → 'vitamin'");
    }
    if (suggestion.applied) {
        throw new Error("Shadow test failed: suggestion should not be applied");
    }
    console.log("✓ Shadow mode suggestion captured without mutation");
}
async function main() {
    const tmpDir = path_1.default.resolve(process.cwd(), "webapp/scripts/testcases/tmp");
    const historyPath = path_1.default.join(tmpDir, "history.json");
    await ensureDir(tmpDir);
    try {
        await runPhraseTest(tmpDir, historyPath);
        await runShortwordTest(tmpDir, historyPath);
        await runShadowModeTest(tmpDir, historyPath);
    }
    finally {
        await promises_1.default.rm(tmpDir, { recursive: true, force: true });
    }
    console.log("All OCR post-correction tests passed.");
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
