import Link from 'next/link';
import { ArrowRight, Scan, Brain, Shield, Users, CheckCircle, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Hero Section */}
      <section className="relative px-6 lg:px-8">
        <div className="mx-auto max-w-7xl pt-20 pb-32 sm:pt-24 sm:pb-40">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              AI-Powered{' '}
              <span className="text-gradient">Nutrition Analysis</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 max-w-3xl mx-auto">
              Scan supplement labels instantly, get AI-powered nutritional analysis, 
              and make informed decisions about your health supplements. 
              Built for the UBC community and health-conscious individuals.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/analyze"
                className="btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Start Analysis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#features"
                className="btn-secondary text-sm font-semibold leading-6"
              >
                Learn more <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Comprehensive Nutrition Intelligence
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Professional-grade analysis powered by AI and backed by scientific research
            </p>
          </div>
          
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {/* OCR Scanning */}
              <div className="flex flex-col medical-card p-6">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <Scan className="h-5 w-5 flex-none text-blue-600" />
                  OCR Label Scanning
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Upload supplement labels and get instant text extraction with ingredient identification. 
                    Supports major brands like Pure Encapsulations, Thorne, and Life Extension.
                  </p>
                </dd>
              </div>

              {/* AI Analysis */}
              <div className="flex flex-col medical-card p-6">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <Brain className="h-5 w-5 flex-none text-green-600" />
                  AI-Powered Analysis
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Get comprehensive nutritional breakdowns including benefits, dosage recommendations, 
                    and safety information based on NIH and Health Canada guidelines.
                  </p>
                </dd>
              </div>

              {/* Safety & Trust */}
              <div className="flex flex-col medical-card p-6">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <Shield className="h-5 w-5 flex-none text-red-600" />
                  Safety & Compliance
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Evidence-based recommendations with interaction warnings, 
                    safety limits, and clear disclaimers. Your health data stays private.
                  </p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Analysis Format Preview */}
      <section className="py-24 sm:py-32 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Professional Analysis Format
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Each supplement receives a comprehensive 8-point analysis in both English and Chinese
            </p>
          </div>
          
          <div className="mx-auto mt-16 max-w-4xl">
            <div className="medical-card p-8">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">基本介绍 (Basic Introduction)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">主要益处 (Primary Benefits)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">推荐摄入量 (RDA Guidelines)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">可耐受最高摄入量 (Safety Limits)</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">常见膳食来源 (Dietary Sources)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">补充剂形式 (Supplement Forms)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">适合关注的情况 (Usage Scenarios)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">风险与注意事项 (Risks & Precautions)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Features */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Demo Features
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Experience the full potential of AI-powered nutrition analysis
            </p>
          </div>
          
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
              {/* Search & Upload */}
              <div className="flex flex-col medical-card p-6">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <Zap className="h-5 w-5 flex-none text-yellow-600" />
                  Multiple Input Methods
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Upload supplement images for OCR scanning or search our database 
                    of popular supplements with instant text-based queries.
                  </p>
                </dd>
              </div>

              {/* Usage Tracking */}
              <div className="flex flex-col medical-card p-6">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <Users className="h-5 w-5 flex-none text-purple-600" />
                  Usage Tracking
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Track your daily supplement usage with our login counter system. 
                    Monitor compliance and build healthy habits.
                  </p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary-600">
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to optimize your nutrition?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-blue-200">
              Join UBC students and health enthusiasts using AI to make smarter supplement decisions.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/analyze"
                className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-blue-600 shadow-sm hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Start Free Analysis
              </Link>
              <Link href="#" className="text-sm font-semibold leading-6 text-white">
                View Documentation <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
          <div className="flex justify-center space-x-6 md:order-2">
            <p className="text-xs leading-5 text-gray-500">
              ⚠️ For educational purposes only. Not medical advice. Consult healthcare providers.
            </p>
          </div>
          <div className="mt-8 md:order-1 md:mt-0">
            <p className="text-center text-xs leading-5 text-gray-500">
              &copy; 2024 Nutrition AI Demo. Built for UBC community.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
