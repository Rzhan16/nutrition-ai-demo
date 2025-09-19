#!/usr/bin/env node

import { createRequire } from 'module'
import { promises as fs } from 'fs'
import path from 'path'

const require = createRequire(import.meta.url)
const cwd = process.cwd()
const outputDir = path.join(cwd, 'public', 'tesseract')

async function ensureDirectory(dir) {
  await fs.mkdir(dir, { recursive: true })
}

function resolveOptional(moduleId) {
  try {
    return require.resolve(moduleId)
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      return null
    }
    throw error
  }
}

async function copyFileOrThrow(label, sourcePath, targetName, moduleId) {
  if (!sourcePath) {
    throw new Error(`Unable to locate ${label} asset. Expected module '${moduleId}'`)
  }

  const destination = path.join(outputDir, targetName)
  await ensureDirectory(path.dirname(destination))
  await fs.copyFile(sourcePath, destination)
  console.log(`[tesseract-assets] Copied ${label} -> ${path.relative(cwd, destination)}`)
}

async function run() {
  const missing = []

  const workerPath = resolveOptional('tesseract.js/dist/worker.min.js')
  if (!workerPath) missing.push('tesseract.js/dist/worker.min.js')

  const coreCandidates = [
    { id: 'tesseract.js-core/tesseract-core.wasm', name: 'tesseract-core.wasm' },
    { id: 'tesseract.js-core/tesseract-core.wasm.js', name: 'tesseract-core.wasm.js' }
  ]

  const resolvedCores = coreCandidates
    .map(candidate => ({ ...candidate, path: resolveOptional(candidate.id) }))
    .filter(candidate => candidate.path)

  if (resolvedCores.length === 0) {
    missing.push(...coreCandidates.map(candidate => candidate.id))
  }

function findFirstExisting(paths) {
  for (const p of paths) {
    const resolved = resolveOptional(p);
    if (resolved) return resolved;
  }
  return null;
}

const langCandidates = [
  '@tesseract.js-data/eng/eng.traineddata.gz',
  '@tesseract.js-data/eng/4.0.0/eng.traineddata.gz',
  '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
];

const languagePath = findFirstExisting(langCandidates);
if (!languagePath) {
  missing.push(...langCandidates);
}

  if (missing.length > 0) {
    throw new Error(`Failed to locate required Tesseract assets:\n- ${missing.join('\n- ')}`)
  }

  await ensureDirectory(outputDir)

  await copyFileOrThrow('worker', workerPath, 'worker.min.js', 'tesseract.js/dist/worker.min.js')

  for (const core of resolvedCores) {
    await copyFileOrThrow(`core (${core.name})`, core.path, core.name, core.id)
  }

  await copyFileOrThrow('language (eng)', languagePath, 'eng.traineddata.gz', '@tesseract.js/language-eng/eng.traineddata.gz')

  console.log('[tesseract-assets] All assets copied successfully')
}

run().catch(error => {
  console.error('[tesseract-assets] Error:', error.message)
  process.exitCode = 1
})
