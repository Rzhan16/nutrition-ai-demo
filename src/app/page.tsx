import Link from 'next/link';
import { FlaskConical } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg-main">
      {/* Hero Section */}
      <main>
        <div className="container py-16 text-center">
          <h2 className="text-5xl font-extrabold text-text-dark leading-tight mb-4">
            Your Personal Nutrition Advisor
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-8">
            AI Nutrition Scanning & Personalized Recommendations. Scientifically customize your health plan.
          </p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Link href="/analyze" className="btn-vibrant">
              Start AI Scanning Now
            </Link>
            <Link 
              href="#about-section" 
              className="bg-surface-white border border-border-light text-text-secondary px-8 py-3 rounded-full text-lg font-semibold shadow-md hover:bg-gray-50 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* AI Scan Section */}
        <section id="scan-section" className="container py-16">
          <div className="card text-center">
            <h3 className="text-3xl font-bold text-text-dark mb-6">
              AI Nutrition Scanning & Smart Analysis
            </h3>
            <p className="text-text-secondary mb-8">
              Upload nutrition label images or directly enter supplement names. AI will provide professional analysis for you.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center space-y-6 md:space-y-0 md:space-x-8">
              <div className="w-full md:w-1/2">
                <label htmlFor="search-input" className="sr-only">Enter supplement name</label>
                <input 
                  type="text" 
                  id="search-input" 
                  placeholder="e.g., Vitamin C or Pure Encapsulations" 
                  className="w-full border border-border-light p-3 rounded-lg focus:ring-2 focus:ring-vibrant-start focus:border-transparent transition-all"
                />
              </div>
              <div className="w-full md:w-1/2">
                <label className="block">
                  <input 
                    type="file" 
                    className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-text-secondary hover:file:bg-gray-200" 
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Sample Analysis Section */}
        <section className="container py-16">
          <div className="card">
            <h3 className="text-3xl font-bold text-text-dark mb-6">AI Analysis Example: Zinc</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-xl font-semibold mb-2">1. Basic Introduction</h4>
                <p className="text-text-secondary">
                  Zinc is an essential mineral that plays multiple roles in the body. It is crucial for immune system function, protein synthesis, DNA repair, and wound healing.
                </p>
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">2. Main Benefits</h4>
                <ul className="text-text-secondary list-disc list-inside">
                  <li>Enhance immunity</li>
                  <li>Promote growth and development</li>
                  <li>Maintain skin health</li>
                  <li>Support metabolic functions</li>
                </ul>
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">3. Recommended Daily Allowance (RDA)</h4>
                <p className="text-text-secondary">
                  Adult males ≈ 11 mg/day; Adult females ≈ 8 mg/day (Source: NIH ODS)
                </p>
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">4. Tolerable Upper Intake Level (UL)</h4>
                <p className="text-text-secondary">
                  Adults ≈ 40 mg/day. Exceeding this amount may cause adverse reactions.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Community Section */}
        <section className="container py-16 text-center">
          <div className="gradient-bg p-8 rounded-2xl text-white shadow-lg">
            <h3 className="text-3xl font-bold mb-4">Join Our Community</h3>
            <p className="text-lg mb-6">
              Share your supplement combinations and health insights with like-minded people.
            </p>
            <Link 
              href="#" 
              className="bg-white text-blue-600 px-8 py-3 rounded-full text-lg font-semibold shadow-md hover:bg-gray-100 transition-colors"
            >
              Explore Community
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="container py-8 text-center text-text-secondary text-sm">
        <p>
          Risk Warning: All information provided on this website is for reference only and cannot replace professional medical advice. 
          If you have health issues, please consult a doctor or registered nutritionist.
        </p>
        <p className="mt-2">&copy; 2024 AI Nutrition Plan. All rights reserved.</p>
      </footer>
    </div>
  );
}
