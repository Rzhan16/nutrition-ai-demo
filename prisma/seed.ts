import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Seed database with popular supplements from major brands
 * Includes Pure Encapsulations, Thorne, Life Extension, NOW Foods, and others
 */

const supplements = [
  // Pure Encapsulations
  {
    name: "Vitamin D3 1000 IU",
    brand: "Pure Encapsulations",
    category: "Vitamins",
    ingredients: [
      { name: "Vitamin D3 (as cholecalciferol)", amount: "25", unit: "mcg" },
      { name: "Medium chain triglycerides", amount: "200", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Vitamin B12 (Methylcobalamin)",
    brand: "Pure Encapsulations",
    category: "Vitamins",
    ingredients: [
      { name: "Vitamin B12 (as methylcobalamin)", amount: "1000", unit: "mcg" },
      { name: "Microcrystalline cellulose", amount: "200", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Magnesium Glycinate",
    brand: "Pure Encapsulations",
    category: "Minerals",
    ingredients: [
      { name: "Magnesium (as magnesium glycinate)", amount: "120", unit: "mg" },
      { name: "Vegetable capsule", amount: "1", unit: "capsule" }
    ],
    verified: true
  },
  {
    name: "Omega-3 Fish Oil",
    brand: "Pure Encapsulations",
    category: "Omega-3",
    ingredients: [
      { name: "EPA (eicosapentaenoic acid)", amount: "500", unit: "mg" },
      { name: "DHA (docosahexaenoic acid)", amount: "250", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Probiotic 50B",
    brand: "Pure Encapsulations",
    category: "Probiotics",
    ingredients: [
      { name: "Lactobacillus acidophilus", amount: "50", unit: "billion CFU" },
      { name: "Bifidobacterium bifidum", amount: "10", unit: "billion CFU" }
    ],
    verified: true
  },

  // Thorne
  {
    name: "Basic Nutrients 2/Day",
    brand: "Thorne",
    category: "Multivitamins",
    ingredients: [
      { name: "Vitamin A (as retinyl palmitate)", amount: "3000", unit: "IU" },
      { name: "Vitamin C (as ascorbic acid)", amount: "200", unit: "mg" },
      { name: "Vitamin D3 (as cholecalciferol)", amount: "1000", unit: "IU" }
    ],
    verified: true
  },
  {
    name: "Omega-3 w/ CoQ10",
    brand: "Thorne",
    category: "Omega-3",
    ingredients: [
      { name: "EPA (eicosapentaenoic acid)", amount: "350", unit: "mg" },
      { name: "DHA (docosahexaenoic acid)", amount: "250", unit: "mg" },
      { name: "Coenzyme Q10", amount: "30", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Zinc Picolinate",
    brand: "Thorne",
    category: "Minerals",
    ingredients: [
      { name: "Zinc (as zinc picolinate)", amount: "15", unit: "mg" },
      { name: "Microcrystalline cellulose", amount: "200", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Iron Bisglycinate",
    brand: "Thorne",
    category: "Minerals",
    ingredients: [
      { name: "Iron (as iron bisglycinate)", amount: "25", unit: "mg" },
      { name: "Vitamin C (as ascorbic acid)", amount: "100", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Meriva-SF (Curcumin Phytosome)",
    brand: "Thorne",
    category: "Herbs",
    ingredients: [
      { name: "Curcumin (as Meriva-SF)", amount: "500", unit: "mg" },
      { name: "Phosphatidylcholine", amount: "100", unit: "mg" }
    ],
    verified: true
  },

  // Life Extension
  {
    name: "CoQ10 with Enhanced Mitochondrial Support",
    brand: "Life Extension",
    category: "Antioxidants",
    ingredients: [
      { name: "Coenzyme Q10 (as ubiquinone)", amount: "100", unit: "mg" },
      { name: "PQQ (pyrroloquinoline quinone)", amount: "20", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Resveratrol with Pterostilbene",
    brand: "Life Extension",
    category: "Antioxidants",
    ingredients: [
      { name: "Trans-resveratrol", amount: "250", unit: "mg" },
      { name: "Pterostilbene", amount: "50", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Vitamin C with Dihydroquercetin",
    brand: "Life Extension",
    category: "Vitamins",
    ingredients: [
      { name: "Vitamin C (as ascorbic acid)", amount: "1000", unit: "mg" },
      { name: "Dihydroquercetin", amount: "100", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Super Omega-3 EPA/DHA",
    brand: "Life Extension",
    category: "Omega-3",
    ingredients: [
      { name: "EPA (eicosapentaenoic acid)", amount: "700", unit: "mg" },
      { name: "DHA (docosahexaenoic acid)", amount: "500", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Melatonin 3 mg",
    brand: "Life Extension",
    category: "Sleep Support",
    ingredients: [
      { name: "Melatonin", amount: "3", unit: "mg" },
      { name: "Microcrystalline cellulose", amount: "200", unit: "mg" }
    ],
    verified: true
  },

  // NOW Foods
  {
    name: "Probiotic-10 25 Billion",
    brand: "NOW Foods",
    category: "Probiotics",
    ingredients: [
      { name: "Lactobacillus acidophilus", amount: "25", unit: "billion CFU" },
      { name: "Bifidobacterium lactis", amount: "10", unit: "billion CFU" }
    ],
    verified: true
  },
  {
    name: "Iron 18 mg",
    brand: "NOW Foods",
    category: "Minerals",
    ingredients: [
      { name: "Iron (as ferrous fumarate)", amount: "18", unit: "mg" },
      { name: "Vitamin C (as ascorbic acid)", amount: "60", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Calcium & Magnesium",
    brand: "NOW Foods",
    category: "Minerals",
    ingredients: [
      { name: "Calcium (as calcium carbonate)", amount: "500", unit: "mg" },
      { name: "Magnesium (as magnesium oxide)", amount: "250", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Vitamin D3 2000 IU",
    brand: "NOW Foods",
    category: "Vitamins",
    ingredients: [
      { name: "Vitamin D3 (as cholecalciferol)", amount: "50", unit: "mcg" },
      { name: "Medium chain triglycerides", amount: "200", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Omega-3 1000 mg",
    brand: "NOW Foods",
    category: "Omega-3",
    ingredients: [
      { name: "EPA (eicosapentaenoic acid)", amount: "180", unit: "mg" },
      { name: "DHA (docosahexaenoic acid)", amount: "120", unit: "mg" }
    ],
    verified: true
  },

  // Garden of Life
  {
    name: "Vitamin Code Raw B-12",
    brand: "Garden of Life",
    category: "Vitamins",
    ingredients: [
      { name: "Vitamin B12 (as methylcobalamin)", amount: "1000", unit: "mcg" },
      { name: "Raw organic beet", amount: "50", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Raw Probiotics Ultimate Care",
    brand: "Garden of Life",
    category: "Probiotics",
    ingredients: [
      { name: "Lactobacillus acidophilus", amount: "100", unit: "billion CFU" },
      { name: "Bifidobacterium bifidum", amount: "50", unit: "billion CFU" }
    ],
    verified: true
  },
  {
    name: "Vitamin Code Raw D3",
    brand: "Garden of Life",
    category: "Vitamins",
    ingredients: [
      { name: "Vitamin D3 (as cholecalciferol)", amount: "2000", unit: "IU" },
      { name: "Raw organic mushroom blend", amount: "100", unit: "mg" }
    ],
    verified: true
  },

  // Nature Made
  {
    name: "Vitamin D3 2000 IU",
    brand: "Nature Made",
    category: "Vitamins",
    ingredients: [
      { name: "Vitamin D3 (as cholecalciferol)", amount: "50", unit: "mcg" },
      { name: "Soybean oil", amount: "200", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Fish Oil 1200 mg",
    brand: "Nature Made",
    category: "Omega-3",
    ingredients: [
      { name: "EPA (eicosapentaenoic acid)", amount: "360", unit: "mg" },
      { name: "DHA (docosahexaenoic acid)", amount: "240", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Calcium 600 mg with D3",
    brand: "Nature Made",
    category: "Minerals",
    ingredients: [
      { name: "Calcium (as calcium carbonate)", amount: "600", unit: "mg" },
      { name: "Vitamin D3 (as cholecalciferol)", amount: "25", unit: "mcg" }
    ],
    verified: true
  },

  // Solgar
  {
    name: "Vitamin D3 5000 IU",
    brand: "Solgar",
    category: "Vitamins",
    ingredients: [
      { name: "Vitamin D3 (as cholecalciferol)", amount: "125", unit: "mcg" },
      { name: "Medium chain triglycerides", amount: "200", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Omega-3 EPA & DHA",
    brand: "Solgar",
    category: "Omega-3",
    ingredients: [
      { name: "EPA (eicosapentaenoic acid)", amount: "504", unit: "mg" },
      { name: "DHA (docosahexaenoic acid)", amount: "378", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Magnesium Citrate",
    brand: "Solgar",
    category: "Minerals",
    ingredients: [
      { name: "Magnesium (as magnesium citrate)", amount: "200", unit: "mg" },
      { name: "Vegetable capsule", amount: "1", unit: "capsule" }
    ],
    verified: true
  },

  // Jarrow Formulas
  {
    name: "Methyl B-12 1000 mcg",
    brand: "Jarrow Formulas",
    category: "Vitamins",
    ingredients: [
      { name: "Vitamin B12 (as methylcobalamin)", amount: "1000", unit: "mcg" },
      { name: "Microcrystalline cellulose", amount: "200", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Saccharomyces Boulardii + MOS",
    brand: "Jarrow Formulas",
    category: "Probiotics",
    ingredients: [
      { name: "Saccharomyces boulardii", amount: "5", unit: "billion CFU" },
      { name: "Mannooligosaccharides (MOS)", amount: "100", unit: "mg" }
    ],
    verified: true
  },

  // Nordic Naturals
  {
    name: "Ultimate Omega",
    brand: "Nordic Naturals",
    category: "Omega-3",
    ingredients: [
      { name: "EPA (eicosapentaenoic acid)", amount: "650", unit: "mg" },
      { name: "DHA (docosahexaenoic acid)", amount: "450", unit: "mg" }
    ],
    verified: true
  },
  {
    name: "Vitamin D3 1000 IU",
    brand: "Nordic Naturals",
    category: "Vitamins",
    ingredients: [
      { name: "Vitamin D3 (as cholecalciferol)", amount: "25", unit: "mcg" },
      { name: "Extra virgin olive oil", amount: "200", unit: "mg" }
    ],
    verified: true
  },

  // Additional popular supplements
  {
    name: "Turmeric Curcumin",
    brand: "Nature's Bounty",
    category: "Herbs",
    ingredients: [
      { name: "Turmeric root extract", amount: "500", unit: "mg" },
      { name: "Curcumin", amount: "50", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "Glucosamine & Chondroitin",
    brand: "Nature's Bounty",
    category: "Joint Support",
    ingredients: [
      { name: "Glucosamine sulfate", amount: "500", unit: "mg" },
      { name: "Chondroitin sulfate", amount: "400", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "Ginkgo Biloba 120 mg",
    brand: "Nature's Bounty",
    category: "Herbs",
    ingredients: [
      { name: "Ginkgo biloba leaf extract", amount: "120", unit: "mg" },
      { name: "Ginkgo flavone glycosides", amount: "24", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "Echinacea 400 mg",
    brand: "Nature's Bounty",
    category: "Immune Support",
    ingredients: [
      { name: "Echinacea purpurea root", amount: "400", unit: "mg" },
      { name: "Echinacea purpurea herb", amount: "100", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "Saw Palmetto 160 mg",
    brand: "Nature's Bounty",
    category: "Men's Health",
    ingredients: [
      { name: "Saw palmetto berry extract", amount: "160", unit: "mg" },
      { name: "Fatty acids", amount: "80", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "Cranberry 500 mg",
    brand: "Nature's Bounty",
    category: "Women's Health",
    ingredients: [
      { name: "Cranberry fruit powder", amount: "500", unit: "mg" },
      { name: "Vitamin C (as ascorbic acid)", amount: "60", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "Biotin 10000 mcg",
    brand: "Nature's Bounty",
    category: "Hair & Nails",
    ingredients: [
      { name: "Biotin", amount: "10000", unit: "mcg" },
      { name: "Microcrystalline cellulose", amount: "200", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "Lutein 20 mg",
    brand: "Nature's Bounty",
    category: "Eye Health",
    ingredients: [
      { name: "Lutein", amount: "20", unit: "mg" },
      { name: "Zeaxanthin", amount: "2", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "CoQ10 100 mg",
    brand: "Nature's Bounty",
    category: "Heart Health",
    ingredients: [
      { name: "Coenzyme Q10", amount: "100", unit: "mg" },
      { name: "Soybean oil", amount: "200", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "Alpha Lipoic Acid 300 mg",
    brand: "Nature's Bounty",
    category: "Antioxidants",
    ingredients: [
      { name: "Alpha lipoic acid", amount: "300", unit: "mg" },
      { name: "Microcrystalline cellulose", amount: "200", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "NAC (N-Acetyl Cysteine) 600 mg",
    brand: "NOW Foods",
    category: "Antioxidants",
    ingredients: [
      { name: "N-Acetyl Cysteine", amount: "600", unit: "mg" },
      { name: "Vegetable capsule", amount: "1", unit: "capsule" }
    ],
    verified: false
  },
  {
    name: "Ashwagandha 450 mg",
    brand: "NOW Foods",
    category: "Adaptogens",
    ingredients: [
      { name: "Ashwagandha root extract", amount: "450", unit: "mg" },
      { name: "Withanolides", amount: "22.5", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "Rhodiola Rosea 500 mg",
    brand: "NOW Foods",
    category: "Adaptogens",
    ingredients: [
      { name: "Rhodiola rosea root extract", amount: "500", unit: "mg" },
      { name: "Rosavins", amount: "15", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "Milk Thistle 175 mg",
    brand: "NOW Foods",
    category: "Liver Support",
    ingredients: [
      { name: "Milk thistle seed extract", amount: "175", unit: "mg" },
      { name: "Silymarin", amount: "140", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "Dandelion Root 500 mg",
    brand: "NOW Foods",
    category: "Liver Support",
    ingredients: [
      { name: "Dandelion root powder", amount: "500", unit: "mg" },
      { name: "Vegetable capsule", amount: "1", unit: "capsule" }
    ],
    verified: false
  },
  {
    name: "5-HTP 100 mg",
    brand: "NOW Foods",
    category: "Mood Support",
    ingredients: [
      { name: "5-Hydroxytryptophan (5-HTP)", amount: "100", unit: "mg" },
      { name: "Microcrystalline cellulose", amount: "200", unit: "mg" }
    ],
    verified: false
  },
  {
    name: "L-Theanine 200 mg",
    brand: "NOW Foods",
    category: "Mood Support",
    ingredients: [
      { name: "L-Theanine", amount: "200", unit: "mg" },
      { name: "Vegetable capsule", amount: "1", unit: "capsule" }
    ],
    verified: false
  },
  {
    name: "GABA 500 mg",
    brand: "NOW Foods",
    category: "Mood Support",
    ingredients: [
      { name: "Gamma-Aminobutyric Acid (GABA)", amount: "500", unit: "mg" },
      { name: "Microcrystalline cellulose", amount: "200", unit: "mg" }
    ],
    verified: false
  }
]

async function main() {
  console.log('🌱 Starting database seed...')
  
  // Clear existing data
  await prisma.scan.deleteMany()
  await prisma.supplement.deleteMany()
  await prisma.user.deleteMany()
  
  console.log('🗑️ Cleared existing data')
  
  // Create supplements
  for (const supplement of supplements) {
    await prisma.supplement.create({
      data: supplement
    })
  }
  
  console.log(`✅ Created ${supplements.length} supplements`)
  
  // Create some sample users
  const sampleUsers = [
    {
      fingerprint: 'user_001',
      loginCount: 5,
      lastLogin: new Date(),
      preferences: {
        dietaryRestrictions: ['vegetarian'],
        healthGoals: ['immune_support', 'energy'],
        age: 25,
        gender: 'female'
      }
    },
    {
      fingerprint: 'user_002',
      loginCount: 12,
      lastLogin: new Date(),
      preferences: {
        dietaryRestrictions: [],
        healthGoals: ['muscle_building', 'recovery'],
        age: 30,
        gender: 'male'
      }
    }
  ]
  
  for (const user of sampleUsers) {
    await prisma.user.create({
      data: user
    })
  }
  
  console.log(`✅ Created ${sampleUsers.length} sample users`)
  
  // Create some sample scans
  const sampleScans = [
    {
      imageUrl: '/uploads/sample_scan_1.jpg',
      ocrText: 'Vitamin D3 1000 IU\nPure Encapsulations\nSupplement Facts',
      analysis: {
        supplementName: 'Vitamin D3',
        brand: 'Pure Encapsulations',
        confidence: 0.95,
        analysis: {
          basicIntroduction: 'Vitamin D3 is essential for bone health and immune function.',
          primaryBenefits: 'Supports bone health, immune system, and calcium absorption.',
          rdaGuidelines: 'Adults: 600-800 IU daily.',
          safetyLimits: 'Upper limit: 4000 IU daily.',
          dietarySources: 'Fatty fish, fortified dairy, sunlight exposure.',
          supplementForms: 'Capsules, tablets, liquid drops.',
          usageScenarios: 'Limited sun exposure, bone health concerns.',
          risksPrecautions: 'May interact with certain medications.'
        }
      },
      userId: 'user_001'
    }
  ]
  
  for (const scan of sampleScans) {
    await prisma.scan.create({
      data: scan
    })
  }
  
  console.log(`✅ Created ${sampleScans.length} sample scans`)
  
  console.log('🎉 Database seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })