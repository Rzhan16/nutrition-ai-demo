'use strict';

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://api.ods.od.nih.gov/dsld/v9/search-filter';
const PAGE_SIZE = 50;
const MIN_DELAY_MS = 150;
const MAX_DELAY_MS = 300;
const MAX_RETRIES = 4; // max number of retries after the initial attempt
const REQUEST_TIMEOUT_MS = 20_000;

const BRANDS = [
  "Sports Research","Thorne","Pure Encapsulations","Nature's Bounty","Nature Made","NOW","Solgar","Garden of Life","Jarrow Formulas","Life Extension","Swanson","Nature's Way","Doctor's Best","MegaFood","New Chapter","Rainbow Light","Country Life","Source Naturals","Nordic Naturals","Bluebonnet Nutrition","Carlson","Twinlab","Douglas Laboratories","Designs for Health","Integrative Therapeutics","Metagenics","Kirkland Signature","GNC","Puritan's Pride","Natrol","Sundown","Optimum Nutrition","MuscleTech","MusclePharm","Vital Proteins","Ancient Nutrition","Orgain","Olly","SmartyPants","Ritual","MaryRuth Organics","Viva Naturals","BioSchwartz","Zhou Nutrition","Physician's Choice","Horbaach","NatureBell","NATURELO","Bronson","21st Century","365 Everyday Value","1MD Nutrition","Kaged","PEScience","Nutricost","NutraBio","Jamieson","Nature's Truth","NaturesPlus","Healthy Origins","Irwin Naturals","Gaia Herbs","Herbalife Nutrition","BSN","Evlution Nutrition","Dr. Tobias","Eu Natural","MAV Nutrition","BeLive","Goli Nutrition","HUM Nutrition","Care/of","The Vitamin Shoppe","Kirkman","Solaray","Trace Minerals Research","ChildLife","Culturelle","Floradix (Salus)","Enzymedica","KAL","Nature's Answer","Renew Life","Schiff","Vitafusion","Spring Valley","Emergen-C","Airborne","Quest Nutrition","Klean Athlete","Bariatric Advantage","Standard Process","Pure Essence Labs","Webber Naturals","Country Farms","Manitoba Harvest","Vega","Havasu Nutrition","NatureWise","Trunature"
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelayMs() {
  return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
}

function computeBackoff(attempt) {
  const jitter = Math.floor(Math.random() * 201); // 0-200 ms jitter
  return 400 * Math.pow(2, attempt) + jitter;
}

let fetchInstance = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;

async function ensureFetch() {
  if (fetchInstance) {
    return fetchInstance;
  }
  const mod = await import('node-fetch').catch(() => null);
  if (mod) {
    const candidate = mod.default || mod.fetch || mod;
    if (typeof candidate === 'function') {
      fetchInstance = candidate;
      return fetchInstance;
    }
  }
  throw new Error('Fetch API is not available. Install node-fetch or upgrade Node.js to v18+.');
}

async function safeFetch(url, attempt = 0) {
  const fetchFn = await ensureFetch();
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;

  try {
    const response = await fetchFn(url, {
      headers: { accept: 'application/json' },
      signal: controller ? controller.signal : undefined,
    });

    if (!response.ok) {
      if (attempt < MAX_RETRIES) {
        const waitMs = computeBackoff(attempt);
        console.warn(`  request failed with status ${response.status}; retrying in ${waitMs}ms (retry ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(waitMs);
        return safeFetch(url, attempt + 1);
      }
      throw new Error(`Request failed with status ${response.status}`);
    }

    try {
      return await response.json();
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const waitMs = computeBackoff(attempt);
        console.warn(`  response parsing failed (${error.message || error}); retrying in ${waitMs}ms (retry ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(waitMs);
        return safeFetch(url, attempt + 1);
      }
      throw error;
    }
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const waitMs = computeBackoff(attempt);
      console.warn(`  request error (${error.message || error}); retrying in ${waitMs}ms (retry ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(waitMs);
      return safeFetch(url, attempt + 1);
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function buildUrl(brand, from) {
  const params = new URLSearchParams({
    q: '*',
    brand,
    size: String(PAGE_SIZE),
    from: String(from),
  });
  return `${BASE_URL}?${params.toString()}`;
}

async function fetchBrand(brand) {
  const results = [];
  const seenIds = new Set();
  let from = 0;
  let pageIndex = 0;

  while (true) {
    const url = buildUrl(brand, from);
    const data = await safeFetch(url);

    if (!data || !Array.isArray(data.hits)) {
      console.warn(`  warning: unexpected response structure for brand "${brand}"; stopping pagination.`);
      break;
    }

    const hits = data.hits;
    if (hits.length === 0) {
      break;
    }

    console.log('  page', pageIndex + 1, 'hits:', hits.length);

    for (const hit of hits) {
      if (!hit || typeof hit !== 'object') {
        continue;
      }
      const dedupeKey = Object.prototype.hasOwnProperty.call(hit, '_id') ? String(hit._id) : JSON.stringify(hit);
      if (seenIds.has(dedupeKey)) {
        continue;
      }
      seenIds.add(dedupeKey);
      results.push(hit);
    }

    from += PAGE_SIZE;
    pageIndex += 1;
    await sleep(randomDelayMs());
  }

  return { hits: results, pages: pageIndex };
}

function toNullableString(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function formatHit(hit) {
  const source = hit && typeof hit === 'object' ? hit._source ?? hit : {};
  const servingSizes = Array.isArray(source?.servingSizes) ? source.servingSizes : [];
  const firstServing = servingSizes.length > 0 && servingSizes[0] && typeof servingSizes[0] === 'object'
    ? servingSizes[0]
    : null;

  return {
    dsldId: toNullableString(hit?._id),
    fullName: toNullableString(source?.fullName),
    brandName: toNullableString(source?.brandName),
    upcSku: toNullableString(source?.upcSku),
    entryDate: toNullableString(source?.entryDate),
    productType: toNullableString(source?.productType?.langualCodeDescription),
    serving: toNullableString(firstServing?.unit),
    pdf: toNullableString(source?.pdf),
    thumbnail: toNullableString(source?.thumbnail),
  };
}

async function main() {
  const labels = [];
  let processedBrands = 0;

  for (const brand of BRANDS) {
    processedBrands += 1;
    try {
      const { hits, pages } = await fetchBrand(brand);
      const formatted = hits.map(formatHit);
      labels.push(...formatted);
      console.log(`Brand: ${brand} — pages: ${pages}, hits: ${formatted.length}`);
    } catch (error) {
      console.error(`Error fetching brand "${brand}":`, error.message || error);
      console.log(`Brand: ${brand} — pages: 0, hits: 0`);
    }
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    api: BASE_URL,
    brands: BRANDS,
    totalLabels: labels.length,
    labels,
  };

  const outputPath = path.resolve(__dirname, 'brands.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`Processed ${processedBrands} brands; collected ${labels.length} labels.`);
  console.log('✅ brands.json written:', outputPath);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error.message || error);
    process.exitCode = 1;
  });
}

