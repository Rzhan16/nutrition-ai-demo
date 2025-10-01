#!/usr/bin/env node
/*
 * Simple secret scanner to keep obvious NIH/OpenAI API keys out of commits.
 * Tailor patterns as needed for additional providers.
 */

const { readFileSync } = require('node:fs');
const { spawn } = require('node:child_process');
const path = require('node:path');

const WORKDIR = process.cwd();

const PATTERNS = [
  {
    name: 'Hard-coded NIH API key',
    regex: /9PvhmrCKv5bItERppMnw6bplksCrvEf2wmOxar3t/,
  },
  {
    name: 'NIH_API_KEY assignment with value',
    regex: /NIH_API_KEY\s*=\s*['\"]?[A-Za-z0-9]{20,}['\"]?/,
  },
  {
    name: 'OPENAI_API_KEY assignment with value',
    regex: /OPENAI_API_KEY\s*=\s*['\"]?sk-[A-Za-z0-9]{10,}['\"]?/,
  },
];

const IGNORED_PATHS = new Set([
  '.git',
  'node_modules',
  '.next',
  'public/tesseract',
  'public/uploads',
  'prisma/dev.db',
]);

const SELF_PATH = 'scripts/check-secrets.js';

function isIgnored(filePath) {
  for (const ignored of IGNORED_PATHS) {
    if (filePath === ignored || filePath.startsWith(`${ignored}/`)) {
      return true;
    }
  }
  return false;
}

function runGitLsFiles() {
  return new Promise((resolve, reject) => {
    const git = spawn('git', ['ls-files', '-z'], { cwd: WORKDIR });
    const chunks = [];

    git.stdout.on('data', (data) => {
      chunks.push(data);
    });

    git.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    git.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`git ls-files exited with code ${code}`));
      } else {
        const buffer = Buffer.concat(chunks);
        const files = buffer.toString('utf8').split('\0').filter(Boolean);
        resolve(files);
      }
    });
  });
}

function scanFile(filePath) {
  if (filePath === SELF_PATH) {
    return [];
  }
  const absolutePath = path.join(WORKDIR, filePath);
  let content;
  try {
    content = readFileSync(absolutePath, 'utf8');
  } catch (error) {
    if (error.code === 'EISDIR' || error.code === 'ENOENT') return [];
    throw error;
  }

  const matches = [];
  for (const { name, regex } of PATTERNS) {
    if (regex.test(content)) {
      matches.push({ filePath, name });
    }
  }
  return matches;
}

async function main() {
  try {
    const files = await runGitLsFiles();
    const findings = [];

    for (const rawFile of files) {
      const file = rawFile.trim();
      if (!file || isIgnored(file)) continue;
      findings.push(...scanFile(file));
    }

    if (findings.length === 0) {
      console.log('✅ No obvious NIH/OpenAI secrets detected.');
      return;
    }

    console.error('❌ Potential secrets found:');
    for (const { filePath, name } of findings) {
      console.error(` - ${name} in ${filePath}`);
    }
    process.exit(1);
  } catch (error) {
    console.error('Secret scan failed:', error);
    process.exit(1);
  }
}

main();
