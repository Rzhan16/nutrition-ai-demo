// batch-ocr.js
// Usage:
//  1) npm i axios axios-cookiejar-support tough-cookie cheerio form-data sanitize-filename p-limit playwright puppeteer
//  2) node batch-ocr.js
// Env:
//  OCR_ENDPOINT   (default: http://localhost:8080/ocr)
//  CONCURRENCY    (default: 2)
//  MIN_CONF       (default: 0.9)
//  SAVE_HTML      (default: false)  # 保存抓取的 HTML 到 batch_ocr_out/html/
//  FORCE_REDO     (default: false)  # true: 即使已有结果也强制重跑

if (typeof global.File === "undefined" && typeof Blob !== "undefined") {
  global.File = class File extends Blob {
    constructor(chunks, name, options = {}) {
      super(chunks, options);
      this.name = name;
      this.lastModified = options.lastModified ?? Date.now();
    }
  };
}

const axiosBase = require("axios");
const { CookieJar } = require("tough-cookie");
const playwright = require("playwright");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const FormData = require("form-data");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const sanitize = require("sanitize-filename");
const pLimit = require("p-limit");
const axios = axiosBase.create();

const {
  buildVocab,
  normalizeForOcr,
  getCandidatesByHeuristics,
  levenshtein,
} = require("./utils/vocab");

const {
  buildVocab,
  normalizeForOcr,
  getCandidatesByHeuristics,
  levenshtein,
} = require("./utils/vocab");

function resolveRequestUrl(config, fallbackUrl) {
  if (!config) return fallbackUrl ?? null;
  const target = config.url ?? null;
  const baseURL = config.baseURL ?? undefined;
  if (target) {
    try {
      return new URL(target, baseURL).toString();
    } catch {
      /* ignore */
    }
  }
  if (fallbackUrl) {
    try {
      return new URL(fallbackUrl).toString();
    } catch {
      return null;
    }
  }
  if (target && /^https?:\/\//i.test(target)) {
    return target;
  }
  return null;
}

function applyCookieJarInterceptors(instance) {
  instance.interceptors.request.use((config) => {
    const jar = config.jar;
    if (!jar) return config;
    const url = resolveRequestUrl(config);
    if (!url) return config;
    const cookie = jar.getCookieStringSync(url);
    if (cookie) {
      config.headers = { ...(config.headers || {}), Cookie: cookie };
    }
    return config;
  });

  const captureResponseCookies = (response) => {
    if (!response?.config?.jar) return response;
    const jar = response.config.jar;
    const setCookie = response.headers?.["set-cookie"];
    if (!setCookie) return response;
    const requestUrl = resolveRequestUrl(
      response.config,
      response.request?.res?.responseUrl
    );
    if (!requestUrl) return response;
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const cookie of cookies) {
      try {
        jar.setCookieSync(cookie, requestUrl);
      } catch (err) {
        console.warn(`[WARN] Failed to store cookie: ${err.message}`);
      }
    }
    return response;
  };

  instance.interceptors.response.use(
    (response) => captureResponseCookies(response),
    (error) => {
      if (error?.response) {
        captureResponseCookies(error.response);
      }
      return Promise.reject(error);
    }
  );
}

applyCookieJarInterceptors(axios);

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
];

let uaIndex = 0;

function nextUserAgent() {
  if (!USER_AGENTS.length) return "Mozilla/5.0 (OCR-Batch/1.0)";
  const agent = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex = (uaIndex + 1) % USER_AGENTS.length;
  return agent;
}

const OCR_ENDPOINT = process.env.OCR_ENDPOINT || "http://localhost:8080/ocr";
const CONCURRENCY = Number(process.env.CONCURRENCY || 2);
const bool = (v, d = false) => {
  const s = String(v ?? (d ? "true" : "false")).toLowerCase();
  return s === "true";
};
const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const MIN_CONF = num(process.env.MIN_CONF, 0.9);
const OCR_POST_CORRECT = bool(process.env.OCR_POST_CORRECT, true);
const OCR_POST_CORRECT_MODE = process.env.OCR_POST_CORRECT_MODE || 'apply'; // apply|shadow
const OCR_POST_CORRECT_RATIO = num(process.env.OCR_POST_CORRECT_RATIO, 1.0);
const OCR_CORRECT_DISTANCE_MAX = num(process.env.OCR_CORRECT_DISTANCE_MAX, 3);
const OCR_CORRECT_REL_MAX = num(process.env.OCR_CORRECT_REL_MAX, 0.25);
const OCR_VOCAB_FROM_SEED = bool(process.env.OCR_VOCAB_FROM_SEED, true);
const OCR_VOCAB_FROM_HISTORY = bool(process.env.OCR_VOCAB_FROM_HISTORY, true);
const OCR_WRITE_VOCAB_SNAPSHOT = bool(process.env.OCR_WRITE_VOCAB_SNAPSHOT, false);
const SAVE_HTML = /^true$/i.test(process.env.SAVE_HTML || "false");
const FORCE_REDO = /^true$/i.test(process.env.FORCE_REDO || "false");

const outDir = path.resolve(process.cwd(), "batch_ocr_out");
const imgDir = path.join(outDir, "images");
const resDir = path.join(outDir, "results");
const htmlDir = path.join(outDir, "html");
const lowConfidenceReport = [];

let VOCAB = {
  brand: [],
  product: [],
  ingredient: [],
  common: [],
  all: [],
};

const PROTECTED_TOKENS = new Set([
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
].map(normalizeForOcr));
const PROTECTED_UNITS_RE = /^\d+(?:\.\d+)?\s*(mg|mcg|g|iu)$/i;

const correctionCache = new Map();
let totalCorrectionsApplied = 0; // suggested (not necessarily applied)
let totalCorrectionDistance = 0;
let brandCorrectionsApplied = 0;
const correctionPairCounter = new Map();

// ---- 待测清单（可以随时加/改）----
const INPUTS = [
  // Sports Research
  { brand: "Sports Research", product: "Vitamin D3 + K2", url: "https://www.sportsresearch.com/products/vitamin-d3-k2" },
  { brand: "Sports Research", product: "Collagen Peptides", url: "https://www.sportsresearch.com/products/collagen-peptides-hydrolyzed-gelatin-2" },
  { brand: "Sports Research", product: "Omega-3 Fish Oil", url: "https://www.sportsresearch.com/products/omega-3-fish-oil-alaskaomegar-1250mg" },
  { brand: "Sports Research", product: "Biotin 5000 mcg", url: "https://www.sportsresearch.com/products/biotin-5000mcg" },

  // Thorne
  { brand: "Thorne", product: "Basic Nutrients 2/Day", url: "https://www.thorne.com/products/dp/basic-nutrients-2-day" },
  { brand: "Thorne", product: "Vitamin D + K2 Liquid", url: "https://www.thorne.com/products/dp/vitamin-d-k2-liquid" },
  { brand: "Thorne", product: "Zinc Picolinate", url: "https://www.thorne.com/products/dp/zinc-picolinate" },
  { brand: "Thorne", product: "Magnesium Glycinate", url: "https://www.thorne.com/products/dp/magnesium-glycinate" },

  // Pure Encapsulations (iHerb)
  { brand: "Pure Encapsulations", product: "B-Complex Plus", url: "https://www.iherb.com/pr/pure-encapsulations-b-complex-plus-120-capsules/51822" },
  { brand: "Pure Encapsulations", product: "Zinc 30", url: "https://www.iherb.com/pr/pure-encapsulations-zinc-30-180-capsules-30-mg-per-capsule/51906" },
  { brand: "Pure Encapsulations", product: "Magnesium (Glycinate)", url: "https://www.iherb.com/pr/pure-encapsulations-magnesium-glycinate-360-capsules-120-mg-per-capsule/51827" },
  { brand: "Pure Encapsulations", product: "O.N.E. Multivitamin", url: "https://www.iherb.com/pr/pure-encapsulations-o-n-e-multivitamin-60-capsules/52461" },

  // Life Extension
  { brand: "Life Extension", product: "Two-Per-Day Capsules", url: "https://www.lifeextension.com/vitamins-supplements/item02314/two-per-day-capsules" },
  { brand: "Life Extension", product: "Super Omega-3", url: "https://www.lifeextension.com/vitamins-supplements/item01982/super-omega-3-epa-dha-fish-oil-sesame-lignans-olive-extract" },
  { brand: "Life Extension", product: "Vitamin D3 5000 IU", url: "https://www.lifeextension.com/vitamins-supplements/item01713/vitamin-d3" },
  { brand: "Life Extension", product: "Magnesium Caps", url: "https://www.lifeextension.com/vitamins-supplements/item01459/magnesium-caps" },

  // NOW
  { brand: "NOW", product: "Vitamin D3 5000 IU Softgels", url: "https://www.nowfoods.com/products/supplements/vitamin-d3-5000-iu-softgels" },
  { brand: "NOW", product: "Omega-3 Fish Oil 1000 mg", url: "https://www.nowfoods.com/products/supplements/omega-3-fish-oil-molecularly-distilled-softgels" },
  { brand: "NOW", product: "Magnesium Citrate 200 mg", url: "https://www.nowfoods.com/products/supplements/magnesium-citrate-200-mg-tablets" },
  { brand: "NOW", product: "Zinc Picolinate 50 mg", url: "https://www.nowfoods.com/products/supplements/zinc-picolinate-50-mg-veg-capsules" },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function backoff(attempt) { return 300 * Math.pow(2, attempt); } // 300ms, 600ms, 1200ms...

async function ensureDirs() {
  await fsp.mkdir(imgDir, { recursive: true });
  await fsp.mkdir(resDir, { recursive: true });
  if (SAVE_HTML) await fsp.mkdir(htmlDir, { recursive: true });
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function absUrl(maybeUrl, baseUrl) {
  try { return new URL(maybeUrl, baseUrl).toString(); }
  catch { return null; }
}

function pickFromSrcset(srcset) {
  // 解析 "url 320w, url2 640w" → 取最大 w
  const parts = (srcset || "").split(",").map(s => s.trim()).filter(Boolean);
  let best = null, bestW = -1;
  for (const p of parts) {
    const [u, w] = p.split(/\s+/);
    const ww = w && w.endsWith("w") ? parseInt(w) : 0;
    if (u && ww >= bestW) { best = u; bestW = ww; }
  }
  return best;
}

function detectLooksLikeFacts(alt, srcLower) {
  const a = (alt || "").toLowerCase();
  const s = (srcLower || "").toLowerCase();
  return a.includes("supplement facts")
      || a.includes("nutrition facts")
      || s.includes("supplement-facts")
      || s.includes("supplementfacts")
      || s.includes("nutrition-facts");
}

function chooseExt(urlPath, contentType) {
  const byCT = (ct) => {
    if (!ct) return null;
    if (ct.includes("jpeg")) return ".jpg";
    if (ct.includes("png")) return ".png";
    if (ct.includes("webp")) return ".webp";
    if (ct.includes("avif")) return ".avif";
    return null;
  };
  return path.extname(urlPath) || byCT(contentType) || ".jpg";
}

function isSvgUrl(link) {
  try {
    return /\.svg(\?|$)/i.test(new URL(link).pathname);
  } catch {
    return false;
  }
}

function vocabAvailable() {
  return Array.isArray(VOCAB?.all) && VOCAB.all.length > 0;
}

let warnedEmptyVocab = false;

function getCorrectionForText(text, cachePrefix = "single") {
  if (!vocabAvailable()) {
    if (!warnedEmptyVocab) {
      console.warn("[WARN] Vocabulary empty, skip correction");
      warnedEmptyVocab = true;
    }
    return null;
  }
  const normalized = normalizeForOcr(text);
  if (!normalized) return null;
  const cacheKey = `${cachePrefix}:${normalized}`;
  if (correctionCache.has(cacheKey)) return correctionCache.get(cacheKey);

  const candidates = getCandidatesByHeuristics(text, VOCAB.all, 200);
  let best = null;
  for (const candidate of candidates) {
    const normCandidate = normalizeForOcr(candidate);
    if (!normCandidate) continue;
    const distance = levenshtein(normalized, normCandidate);
    const longest = Math.max(normalized.length, normCandidate.length, 1);
    const rel = distance / longest;
    if (distance > OCR_CORRECT_DISTANCE_MAX || rel > OCR_CORRECT_REL_MAX) continue;
    if (!best || distance < best.distance || (distance === best.distance && rel < best.rel)) {
      best = { corrected: candidate, distance, rel };
    }
  }

  correctionCache.set(cacheKey, best);
  return best;
}

function hashToUnitInterval(str = "") {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return (h >>> 0) / 0xffffffff;
}

function shouldApplySample(normalizedText = "") {
  if (OCR_POST_CORRECT_MODE !== 'apply') return false;
  if (OCR_POST_CORRECT_RATIO >= 1) return true;
  const r = hashToUnitInterval(normalizedText);
  return r <= OCR_POST_CORRECT_RATIO;
}

function computeStats(ocr, ctx = {}) {
  const words = Array.isArray(ocr?.words) ? ocr.words : [];
  const audits = [];
  const lowConfidenceWords = [];
  let lowestWord = null;

  for (let index = 0; index < words.length; index++) {
    const wordEntry = words[index] || {};
    const originalText = typeof wordEntry.text === "string" ? wordEntry.text : "";
    const confidence = Number(wordEntry.confidence) || 0;

    if (confidence < MIN_CONF) {
      lowConfidenceWords.push(wordEntry);

      const normalized = normalizeForOcr(originalText);
      const isUnitPattern = PROTECTED_UNITS_RE.test(originalText || "");
      let textCorrected = null;
      let distance = null;
      let relDistance = null;
      let usedNeighborMerge = false;

      const isProtected = (normalized && PROTECTED_TOKENS.has(normalized)) || isUnitPattern;

      if (!isProtected && normalized && vocabAvailable()) {
        let correction = getCorrectionForText(originalText, "single");
        let mergeDirection = null;

        if (!correction && words[index + 1] && typeof words[index + 1].text === "string") {
          const mergedForward = `${originalText}${words[index + 1].text}`;
          correction = getCorrectionForText(mergedForward, "merge-forward");
          if (correction) {
            usedNeighborMerge = true;
            mergeDirection = "forward";
          }
        }

        if (!correction && words[index - 1] && typeof words[index - 1].text === "string") {
          const mergedBackward = `${words[index - 1].text}${originalText}`;
          correction = getCorrectionForText(mergedBackward, "merge-backward");
          if (correction) {
            usedNeighborMerge = true;
            mergeDirection = "backward";
          }
        }

        if (correction && correction.corrected && correction.corrected !== originalText) {
          textCorrected = correction.corrected;
          distance = correction.distance;
          relDistance = correction.rel;
          if (OCR_POST_CORRECT && OCR_POST_CORRECT_MODE === 'apply' && shouldApplySample(normalized)) {
            wordEntry.text = textCorrected;
            if (usedNeighborMerge && mergeDirection === "forward" && words[index + 1]) {
              words[index + 1].text = words[index + 1].text;
            }
          }
        }
      }

      audits.push({
        text_original: originalText || null,
        text_corrected:
          textCorrected && textCorrected !== originalText ? textCorrected : null,
        distance:
          textCorrected && textCorrected !== originalText && distance != null
            ? distance
            : null,
        rel_distance:
          textCorrected && textCorrected !== originalText && relDistance != null
            ? relDistance
            : null,
        used_neighbor_merge: usedNeighborMerge,
        confidence: Number(confidence.toFixed(4)),
        vocab_pool: "all",
        brand_context: ctx?.brand || null,
        product_context: ctx?.product || null,
        block_id: wordEntry.block_id ?? null,
        line_id: wordEntry.line_id ?? null,
      });
    }

    const currentConfidence = Number(wordEntry.confidence) || 0;
    if (!lowestWord || currentConfidence < lowestWord.confidence) {
      lowestWord = {
        text: typeof wordEntry.text === "string" ? wordEntry.text : null,
        confidence: Number(currentConfidence.toFixed(4)),
      };
    }
  }

  const confidences = words
    .map((w) => Number(w.confidence))
    .filter((n) => Number.isFinite(n));
  const averageConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;
  const minConfidence = confidences.length ? Math.min(...confidences) : 0;

  return {
    count: words.length,
    avg_conf: Number(averageConfidence.toFixed(4)),
    avg_confidence: Number(averageConfidence.toFixed(4)),
    min_conf: Number(minConfidence.toFixed(4)),
    low_conf_count: lowConfidenceWords.length,
    low_conf_words: lowConfidenceWords,
    lowest_word: lowestWord,
    corrections: audits,
  };
}

function updateGlobalCorrectionStats(audits = []) {
  if (!Array.isArray(audits)) return;
  for (const entry of audits) {
    if (!entry || !entry.text_corrected || entry.text_corrected === entry.text_original) {
      continue;
    }
    totalCorrectionsApplied += 1;
    if (typeof entry.distance === "number") {
      totalCorrectionDistance += entry.distance;
    }
    const key = `${entry.text_original || ""}→${entry.text_corrected}`;
    correctionPairCounter.set(key, (correctionPairCounter.get(key) || 0) + 1);

    if (entry.brand_context) {
      const brandNorm = normalizeForOcr(entry.brand_context);
      const correctedNorm = normalizeForOcr(entry.text_corrected);
      if (brandNorm && correctedNorm.includes(brandNorm)) {
        brandCorrectionsApplied += 1;
      }
    }
  }
}

function countAppliedCorrections(audits = []) {
  if (!Array.isArray(audits)) return 0;
  return audits.filter((entry) => entry?.text_corrected && entry.text_corrected !== entry.text_original).length;
}

function averageDistance(audits = []) {
  const distances = audits
    .filter((entry) => entry?.text_corrected && entry.text_corrected !== entry.text_original && typeof entry.distance === "number")
    .map((entry) => entry.distance);
  if (!distances.length) return 0;
  const total = distances.reduce((sum, value) => sum + value, 0);
  return total / distances.length;
}

function auditsWithContext(audits = [], ctx = {}, extras = {}) {
  if (!Array.isArray(audits)) return [];
  return audits.map((entry) => ({
    ...entry,
    brand: ctx?.brand || null,
    product: ctx?.product || null,
    image: extras?.image || null,
    threshold: extras?.threshold ?? null,
  }));
}

async function withRetry(fn, label, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const wait = backoff(i);
      console.warn(`[WARN] ${label} failed (attempt ${i+1}/${tries}): ${e.message}. Retry in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function fetchHtml(url) {
  const jar = new CookieJar();
  const label = `fetchHtml(${url})`;
  const isIHerb = /iherb\.com/i.test(url);

  try {
    return await withRetry(async () => {
      const userAgent = nextUserAgent();
      const res = await axios.get(url, {
        responseType: "text",
        headers: {
          "User-Agent": userAgent,
          "Accept-Language": "en-US,en;q=0.8",
        },
        timeout: 30000,
        maxRedirects: 5,
        jar,
        withCredentials: true,
      });
      return res.data;
    }, label);
  } catch (err) {
    const status = err?.response?.status;
    if (isIHerb && status === 403) {
      console.warn(`[INFO] Cloudflare 403 for ${url}, switching to Playwright.`);
      return await fetchHtmlWithPlaywright(url);
    }
    throw err;
  }
}

async function fetchHtmlWithPlaywright(url) {
  const userAgent = nextUserAgent();
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent, locale: "en-US" });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function fetchHtmlWithPuppeteer(url) {
  const browser = await puppeteer.launch({ headless: "new", timeout: 60000 });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(nextUserAgent());
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (/nowfoods\.com/i.test(url)) {
      try {
        await page.waitForSelector('button', { timeout: 5000 });
        await page.click('button', { timeout: 5000 });
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (err) {
        console.warn(`[WARN] NOW Foods interactive load failed: ${err.message}`);
      }
    }
    return await page.content();
  } finally {
    await browser.close();
  }
}

function extractCandidateImages(html, baseUrl) {
  const $ = cheerio.load(html);
  const cands = [];

  // img/懒加载/srcset
  $("img").each((_, el) => {
    const alt = $(el).attr("alt") || "";
    const attrs = [
      $(el).attr("src"),
      $(el).attr("data-src"),
      $(el).attr("data-original"),
      $(el).attr("data-largeimg"),
    ].filter(Boolean);

    const srcset = $(el).attr("srcset");
    if (srcset) {
      const best = pickFromSrcset(srcset);
      if (best) attrs.unshift(best);
    }

    for (const src of attrs) {
      const u = absUrl(src, baseUrl);
      if (!u) continue;
      if (isSvgUrl(u)) continue;
      const looksFacts = detectLooksLikeFacts(alt, src);
      cands.push({ url: u, priority: looksFacts ? 1 : 2 });
    }
  });

  // og:image 兜底
  const og = $('meta[property="og:image"]').attr("content")
    || $('meta[name="og:image"]').attr("content");
  if (og) {
    const abs = absUrl(og, baseUrl);
    if (abs && !isSvgUrl(abs)) {
      cands.push({ url: abs, priority: 3 });
    }
  }

  // 去重 + 按优先级排序（1 最优）
  const uniq = [];
  const seen = new Set();
  for (const c of cands) {
    if (c.url && !seen.has(c.url)) {
      seen.add(c.url);
      uniq.push(c);
    }
  }
  uniq.sort((a, b) => a.priority - b.priority);
  return uniq.map(x => x.url);
}

async function downloadImage(url, filepath, referer) {
  const userAgent = nextUserAgent();
  const res = await withRetry(async () =>
    axios.get(url, {
      responseType: "arraybuffer",
      timeout: 60000,
      headers: {
        "User-Agent": userAgent,
        "Accept": "image/*,*/*;q=0.8",
        ...(referer ? { Referer: referer } : {}),
      },
      maxRedirects: 5
    })
  , `downloadImage(${url})`);

  const buf = Buffer.from(res.data);
  // 用 sha256 命名缓存，避免重复下载
  const digest = sha256(buf);
  const finalPath = filepath.replace(/(\.[a-z0-9]+)$/i, `_${digest}$1`);
  await fsp.writeFile(finalPath, buf);
  return { finalPath, contentType: res.headers["content-type"] || "" };
}

async function postToOCR(filepath) {
  return withRetry(async () => {
    const form = new FormData();
    form.append("file", fs.createReadStream(filepath));
    const res = await axios.post(OCR_ENDPOINT, form, {
      headers: form.getHeaders(),
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return res.data;
  }, `postToOCR(${path.basename(filepath)})`);
}

async function processOne(item, idx, total) {
  const start = Date.now();
  const slug = sanitize(`${item.brand}_${item.product}`).replace(/\s+/g, "_");
  const resJsonPath = path.join(resDir, `${slug}.json`);
  const lowJsonPath = path.join(resDir, `${slug}.lowconf.json`);
  const htmlPath = path.join(htmlDir, `${slug}.html`);

  try {
    if (!FORCE_REDO && fs.existsSync(resJsonPath)) {
      const existing = JSON.parse(await fsp.readFile(resJsonPath, "utf-8"));
      const stats = computeStats(existing.ocr, item);
      existing.stats = stats;
      existing.corrections = stats.corrections;
      existing.meta = {
        MIN_CONF,
        OCR_ENDPOINT,
        OCR_POST_CORRECT,
        OCR_POST_CORRECT_MODE,
        OCR_POST_CORRECT_RATIO,
      };
      await fsp.writeFile(resJsonPath, JSON.stringify(existing, null, 2), "utf-8");

      const imageRef = existing.imgPath || existing.imgUrl;
      const contextualAudits = auditsWithContext(stats.corrections, item, {
        image: imageRef,
        threshold: MIN_CONF,
      });
      lowConfidenceReport.push(...contextualAudits);
      updateGlobalCorrectionStats(stats.corrections);

      const correctionsCount = countAppliedCorrections(stats.corrections);
      const elapsed = Date.now() - start;
      console.log(
        `[SKIP] ${idx}/${total} ${item.brand} - ${item.product} (cache) avg=${stats.avg_conf} low=${stats.low_conf_count} corrections=${correctionsCount}`
      );
      return {
        ...item,
        status: "exists",
        result: resJsonPath,
        stats,
        corrections: stats.corrections,
        imgUrl: existing.imgUrl,
        filtered_count: existing.filtered_count ?? existing.ocr?.filtered_count ?? 0,
        corrected_count: existing.corrected_count ?? existing.ocr?.corrected_count ?? 0,
        elapsedMs: elapsed,
      };
    }

    let html = await fetchHtml(item.url);
    if (SAVE_HTML) {
      await fsp.writeFile(htmlPath, html, "utf-8");
    }

    let images = extractCandidateImages(html, item.url);

    if (images.length === 0) {
      console.warn(`[WARN] No image candidates via static fetch for: ${item.brand} - ${item.product}. Trying Puppeteer fallback.`);
      try {
        const dynamicHtml = await fetchHtmlWithPuppeteer(item.url);
        images = extractCandidateImages(dynamicHtml, item.url);
        if (images.length > 0) {
          html = dynamicHtml;
          if (SAVE_HTML) {
            await fsp.writeFile(path.join(htmlDir, `${slug}.puppeteer.html`), dynamicHtml, "utf-8");
          }
        } else {
          console.warn(`[WARN] Puppeteer fallback yielded no images for: ${item.brand} - ${item.product}`);
        }
      } catch (puppErr) {
        console.warn(`[WARN] Puppeteer fallback failed for ${item.brand} - ${item.product}: ${puppErr.message}`);
      }
    }

    if (images.length === 0) {
      const elapsed = Date.now() - start;
      return { ...item, status: "no_images", elapsedMs: elapsed };
    }

    const imgUrl = images[0];
    const urlPath = new URL(imgUrl).pathname;
    const extGuess = path.extname(urlPath) || ".jpg";
    const basePath = path.join(imgDir, `${slug}${extGuess}`);

    const { finalPath, contentType } = await downloadImage(imgUrl, basePath, item.url);
    const realExt = chooseExt(urlPath, contentType);
    let imgPath = finalPath;
    if (realExt && !finalPath.endsWith(realExt)) {
      const renamed = finalPath.replace(/\.[a-z0-9]+$/i, realExt);
      await fsp.rename(finalPath, renamed);
      imgPath = renamed;
    }

    const ocr = await postToOCR(imgPath);
    const stats = computeStats(ocr, item);
    const contextualAudits = auditsWithContext(stats.corrections, item, {
      image: imgPath,
      threshold: MIN_CONF,
    });
    lowConfidenceReport.push(...contextualAudits);
    updateGlobalCorrectionStats(stats.corrections);

    const payload = {
      item,
      imgUrl,
      imgPath,
      ocr,
      stats,
      corrections: stats.corrections,
      meta: {
        MIN_CONF,
        OCR_ENDPOINT,
        OCR_POST_CORRECT,
        OCR_POST_CORRECT_MODE,
        OCR_POST_CORRECT_RATIO,
      },
    };
    await fsp.writeFile(resJsonPath, JSON.stringify(payload, null, 2), "utf-8");

    if (stats.low_conf_count > 0) {
      await fsp.writeFile(lowJsonPath, JSON.stringify({
        item,
        imgUrl,
        imgPath,
        MIN_CONF,
        low: stats.low_conf_words,
        corrections: stats.corrections,
      }, null, 2), "utf-8");
    } else if (fs.existsSync(lowJsonPath)) {
      await fsp.rm(lowJsonPath);
    }

    const fc = ocr.filtered_count ?? 0;
    const cc = ocr.corrected_count ?? 0;
    const correctionsCount = countAppliedCorrections(stats.corrections);
    const elapsed = Date.now() - start;
    console.log(
      `[OK] ${idx}/${total} ${item.brand} - ${item.product} | words=${stats.count} avg=${stats.avg_conf} min=${stats.min_conf} low=${stats.low_conf_count} corrections=${correctionsCount} filter=${fc} correct=${cc} time=${(elapsed / 1000).toFixed(2)}s`
    );

    return {
      ...item,
      imgUrl,
      result: resJsonPath,
      status: "ok",
      stats,
      corrections: stats.corrections,
      filtered_count: fc,
      corrected_count: cc,
      elapsedMs: elapsed,
    };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`[ERR] ${idx}/${total} ${item.brand} - ${item.product}: ${err.message}`);
    return { ...item, status: "error", error: err.message, elapsedMs: elapsed };
  }
}

async function writeSummary(all) {
  const globalAvgDistance = totalCorrectionsApplied
    ? totalCorrectionDistance / totalCorrectionsApplied
    : 0;
  const brandFixRate = totalCorrectionsApplied
    ? brandCorrectionsApplied / totalCorrectionsApplied
    : 0;
  const topCorrections = Array.from(correctionPairCounter.entries())
    .map(([pair, count]) => {
      const [original, corrected] = pair.split("→");
      return { original, corrected, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  for (const entry of all) {
    const audits = Array.isArray(entry?.corrections)
      ? entry.corrections
      : Array.isArray(entry?.stats?.corrections)
        ? entry.stats.corrections
        : [];
    const applied = countAppliedCorrections(audits);
    const avgDist = Number(averageDistance(audits).toFixed(4));
    let brandHits = 0;
    if (Array.isArray(audits)) {
      for (const audit of audits) {
        if (!audit?.text_corrected || !audit.brand_context) continue;
        const brandNorm = normalizeForOcr(audit.brand_context);
        const correctedNorm = normalizeForOcr(audit.text_corrected);
        if (brandNorm && correctedNorm.includes(brandNorm)) {
          brandHits += 1;
        }
      }
    }
    const brandRateItem = audits.length ? Number((brandHits / audits.length).toFixed(4)) : 0;

    entry.corrections_count = audits.length;
    entry.corrections_applied = applied;
    entry.corrections_avg_distance = avgDist;
    entry.brand_fix_rate = brandRateItem;
    entry.total_corrections_global = totalCorrectionsApplied;
    entry.avg_correction_distance_global = Number(globalAvgDistance.toFixed(4));
    entry.brand_fix_rate_global = Number(brandFixRate.toFixed(4));
    entry.top_corrections_global = topCorrections;
  }

  const sumPath = path.join(outDir, "summary.json");
  await fsp.writeFile(sumPath, JSON.stringify(all, null, 2), "utf-8");

  // CSV 方便快速筛查
  const csvPath = path.join(outDir, "summary.csv");
  const header = "brand,product,status,avg_conf,min_conf,low_conf,filtered_count,corrected_count,elapsed_ms,corrections_count,corrections_applied,corrections_avg_distance,brand_fix_rate,total_corrections_global,avg_correction_distance_global,brand_fix_rate_global,top_corrections_global,imgUrl,result\n";
  const lines = all.map(r => {
    const s = r.stats || {};
    return [
      JSON.stringify(r.brand || ""),
      JSON.stringify(r.product || ""),
      r.status || "",
      s.avg_conf ?? "",
      s.min_conf ?? "",
      s.low_conf_count ?? "",
      r.filtered_count ?? "",
      r.corrected_count ?? "",
      r.elapsedMs ?? "",
      r.corrections_count ?? "",
      r.corrections_applied ?? "",
      r.corrections_avg_distance ?? "",
      r.brand_fix_rate ?? "",
      r.total_corrections_global ?? "",
      r.avg_correction_distance_global ?? "",
      r.brand_fix_rate_global ?? "",
      JSON.stringify(r.top_corrections_global || []),
      JSON.stringify(r.imgUrl || ""),
      JSON.stringify(r.result || "")
    ].join(",");
  });
  await fsp.writeFile(csvPath, header + lines.join("\n"), "utf-8");

  const lowPath = path.join(outDir, "low_confidence_words.json");
  await fsp.writeFile(lowPath, JSON.stringify(lowConfidenceReport, null, 2), "utf-8");
  console.log(`\n✅ Summary saved:\n- ${sumPath}\n- ${csvPath}`);
  console.log(`- ${lowPath}`);
}

function printSummaryTable(all) {
  const rows = all.map(r => ({
    brand: r.brand,
    product: r.product,
    status: r.status,
    avg_confidence: r.stats?.avg_confidence ?? null,
    time_s: r.elapsedMs != null ? Number((r.elapsedMs / 1000).toFixed(2)) : null,
  }));
  console.log("\n📊 Run Summary");
  console.table(rows);
}

async function run() {
  await ensureDirs();
  const vocabStart = Date.now();
  try {
    VOCAB = await buildVocab({
      useSeed: OCR_VOCAB_FROM_SEED,
      useHistory: OCR_VOCAB_FROM_HISTORY,
      writeSnapshot: OCR_WRITE_VOCAB_SNAPSHOT,
    });
  } catch (error) {
    console.warn(`[WARN] Failed to build vocabulary: ${error.message}`);
    VOCAB = { brand: [], product: [], ingredient: [], common: [], all: [] };
  }
  warnedEmptyVocab = false;
  const vocabElapsed = Date.now() - vocabStart;
  console.log(
    `[INFO] Vocab built in ${vocabElapsed}ms (brand=${VOCAB.brand.length}, product=${VOCAB.product.length}, ingredient=${VOCAB.ingredient.length}, common=${VOCAB.common.length}, all=${VOCAB.all.length})`
  );
  if (!vocabAvailable()) {
    console.warn("[WARN] Vocabulary empty, skip correction");
    warnedEmptyVocab = true;
  }

  console.log(
    `🔧 OCR_ENDPOINT=${OCR_ENDPOINT}  CONCURRENCY=${CONCURRENCY}  MIN_CONF=${MIN_CONF}  FORCE_REDO=${FORCE_REDO}  OCR_POST_CORRECT=${OCR_POST_CORRECT}  MODE=${OCR_POST_CORRECT_MODE}  RATIO=${OCR_POST_CORRECT_RATIO}  DIST_MAX=${OCR_CORRECT_DISTANCE_MAX}  REL_MAX=${OCR_CORRECT_REL_MAX}`
  );

  const limit = pLimit(CONCURRENCY);
  const tasks = INPUTS.map((item, i) => limit(() => processOne(item, i + 1, INPUTS.length)));
  const settled = await Promise.allSettled(tasks);

  const results = settled.map((entry, idx) => {
    if (entry.status === "fulfilled") return entry.value;
    const item = INPUTS[idx];
    const reason = entry.reason instanceof Error ? entry.reason.message : String(entry.reason);
    console.error(`[ERR] Task failed for ${item.brand} - ${item.product}: ${reason}`);
    return { ...item, status: "error", error: reason, elapsedMs: null };
  });

  await writeSummary(results);
  printSummaryTable(results);

  const globalAvgDistance = totalCorrectionsApplied
    ? totalCorrectionDistance / totalCorrectionsApplied
    : 0;
  const brandFixRate = totalCorrectionsApplied
    ? brandCorrectionsApplied / totalCorrectionsApplied
    : 0;
  console.log(
    `Corrections applied: ${totalCorrectionsApplied}, avg dist: ${globalAvgDistance.toFixed(3)}, brand fix rate: ${brandFixRate.toFixed(4)}`
  );
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
