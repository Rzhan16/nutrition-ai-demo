/**
 * Mock data for Vercel deployment when database is not available
 * This allows the API to work immediately while setting up the database
 */

export const mockSupplements = [
  {
    id: "mock-1",
    name: "Vitamin D3 1000 IU",
    brand: "Pure Encapsulations",
    category: "Vitamins",
    ingredients: [
      { name: "Vitamin D3 (as cholecalciferol)", amount: "25", unit: "mcg" },
      { name: "Medium chain triglycerides", amount: "200", unit: "mg" }
    ],
    verified: true,
    createdAt: new Date(),
    _count: { scans: 0 },
    relevanceScore: 10
  },
  {
    id: "mock-2",
    name: "Omega-3 Fish Oil",
    brand: "Nordic Naturals",
    category: "Omega-3",
    ingredients: [
      { name: "EPA (eicosapentaenoic acid)", amount: "650", unit: "mg" },
      { name: "DHA (docosahexaenoic acid)", amount: "450", unit: "mg" }
    ],
    verified: true,
    createdAt: new Date(),
    _count: { scans: 0 },
    relevanceScore: 9
  },
  {
    id: "mock-3",
    name: "Magnesium Glycinate",
    brand: "Thorne",
    category: "Minerals",
    ingredients: [
      { name: "Magnesium (as magnesium glycinate)", amount: "120", unit: "mg" }
    ],
    verified: true,
    createdAt: new Date(),
    _count: { scans: 0 },
    relevanceScore: 8
  }
]

export const mockAnalysis = {
  supplementName: "Vitamin D3",
  brand: "Generic",
  confidence: 0.88,
  analysis: {
    basicIntroduction: "Vitamin D3 (cholecalciferol) is a fat-soluble vitamin essential for bone health and immune function.",
    primaryBenefits: "Supports bone health, immune system function, and calcium absorption. May help prevent osteoporosis and support cardiovascular health.",
    rdaGuidelines: "Adults: 600-800 IU (15-20 mcg) daily. Higher doses may be needed for deficiency correction under medical supervision.",
    safetyLimits: "Upper limit: 4000 IU (100 mcg) daily for adults. Excessive intake can lead to hypercalcemia and kidney damage.",
    dietarySources: "Fatty fish (salmon, mackerel), fortified dairy products, egg yolks, and sunlight exposure.",
    supplementForms: "Capsules, tablets, liquid drops, and gummies. D3 (cholecalciferol) is more effective than D2 (ergocalciferol).",
    usageScenarios: "Recommended for individuals with limited sun exposure, darker skin, older adults, and those with bone health concerns.",
    risksPrecautions: "May interact with certain medications. Consult healthcare provider if taking blood thinners or have kidney disease."
  },
  ingredients: [
    {
      name: "Vitamin D3",
      amount: "25",
      unit: "mcg",
      dailyValue: 125
    }
  ],
  warnings: [
    "Keep out of reach of children",
    "Do not exceed recommended dosage",
    "Consult healthcare provider if pregnant or nursing"
  ],
  recommendations: [
    "Take with a meal containing fat for better absorption",
    "Consider testing vitamin D levels before and after supplementation",
    "Combine with calcium and magnesium for optimal bone health"
  ],
  scanId: "mock-scan-1",
  cached: false,
  ocrConfidence: 0.92
}