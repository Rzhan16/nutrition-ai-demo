import fsp from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";

async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

async function copyFixture(fileName: string, targetDir: string): Promise<string> {
  const source = path.resolve(
    process.cwd(),
    "webapp/scripts/testcases/samples",
    fileName
  );
  const target = path.join(targetDir, fileName);
  await fsp.copyFile(source, target);
  return target;
}

function runBatchOcr(filePath: string, env: NodeJS.ProcessEnv): void {
  const result = spawnSync(
    process.execPath,
    [
      path.resolve(process.cwd(), "dist/batch-ocr.js"),
      "--mode=file",
      `--file=${filePath}`,
    ],
    {
      env: {
        ...process.env,
        ...env,
      },
      stdio: "inherit",
    }
  );
  if (result.status !== 0) {
    throw new Error(`OCR batch script failed for ${filePath}`);
  }
}

interface TestWord {
  text?: string;
}

interface TestCorrection {
  text_corrected?: string;
  applied?: boolean;
}

interface TestResult {
  ocr?: {
    words?: TestWord[];
  };
  corrections?: TestCorrection[];
}

async function readJson(filePath: string): Promise<TestResult> {
  const raw = await fsp.readFile(filePath, "utf-8");
  return JSON.parse(raw) as TestResult;
}

async function runPhraseTest(tmpDir: string, historyPath: string) {
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
    throw new Error(
      `Phrase test failed: expected 'dietary supplement', received '${first} ${second}'`
    );
  }
  console.log("✓ Phrase template correction applied");
}

async function runShortwordTest(tmpDir: string, historyPath: string) {
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
    .filter((value): value is string => typeof value === "string");
  if (!texts.includes("mg") || !texts.includes("d3")) {
    throw new Error(
      `Shortword test failed: tokens mutated unexpectedly (${texts.join(", ")})`
    );
  }
  console.log("✓ Shortword protection validated");
}

async function runShadowModeTest(tmpDir: string, historyPath: string) {
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
    throw new Error(
      `Shadow test failed: expected raw token to remain 'vitamln', received '${original}'`
    );
  }
  const suggestion = corrections.find(
    (entry) => entry.text_corrected === "vitamin"
  );
  if (!suggestion) {
    throw new Error(
      "Shadow test failed: expected suggestion for 'vitamln' → 'vitamin'"
    );
  }
  if (suggestion.applied) {
    throw new Error("Shadow test failed: suggestion should not be applied");
  }
  console.log("✓ Shadow mode suggestion captured without mutation");
}

async function main(): Promise<void> {
  const tmpDir = path.resolve(
    process.cwd(),
    "webapp/scripts/testcases/tmp"
  );
  const historyPath = path.join(tmpDir, "history.json");
  await ensureDir(tmpDir);
  try {
    await runPhraseTest(tmpDir, historyPath);
    await runShortwordTest(tmpDir, historyPath);
    await runShadowModeTest(tmpDir, historyPath);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
  console.log("All OCR post-correction tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
