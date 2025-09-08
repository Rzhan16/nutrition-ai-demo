'use client';

import { Upload, Search, Zap, Shield, Brain } from 'lucide-react';
import { FileUpload } from '@/components/upload/FileUpload';
import { SearchBox } from '@/components/search/SearchBox';

export default function AnalyzePage() {
  return (
    <div className="min-h-screen bg-pure-gray">
      {/* ✨ Hero Section with Vitality Gradient */}
      <section className="relative px-6 pt-20 pb-24 lg:px-8 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-vitality-primary/5 via-pure-white to-vitality-green/5"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-vitality-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-vitality-green/10 rounded-full blur-3xl"></div>
        
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-pure-border rounded-full mb-8">
            <div className="w-2 h-2 bg-vitality-green rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-text-secondary">AI-Powered • Scientific • Trusted</span>
          </div>
          
          <h1 className="text-5xl font-bold tracking-tight text-text-primary sm:text-6xl lg:text-7xl">
            <span className="block">智能营养</span>
            <span className="block bg-gradient-to-r from-vitality-primary via-vitality-green to-vitality-orange bg-clip-text text-transparent">
              AI Analysis
            </span>
          </h1>
          
          <p className="mt-8 text-xl leading-relaxed text-text-secondary max-w-3xl mx-auto">
            专业AI扫描营养补充剂标签，获得科学数据支持的个性化健康建议。
            <span className="block mt-2 text-text-accent font-medium">为UBC社区打造的可信赖营养分析平台</span>
          </p>
          
          {/* Trust Indicators */}
          <div className="mt-10 flex items-center justify-center gap-8 text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-success rounded-full"></div>
              <span>科学验证</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-info rounded-full"></div>
              <span>隐私保护</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-warning rounded-full"></div>
              <span>即时分析</span>
            </div>
          </div>
        </div>
      </section>

      {/* 🎯 Main Analysis Interface */}
      <section className="px-6 pb-32 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            
            {/* 📱 Upload Section - Sports Research Style */}
            <div className="medical-card p-10 group">
              <div className="text-center">
                <div className="relative mx-auto flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-vitality-primary to-vitality-green mb-8 group-hover:scale-110 transition-all duration-500">
                  <Upload className="h-10 w-10 text-white" />
                  <div className="absolute -inset-1 bg-gradient-to-br from-vitality-primary to-vitality-green rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
                </div>
                
                <h2 className="text-3xl font-bold text-text-primary mb-4">
                  📸 智能扫描
                  <span className="block text-lg font-medium text-text-accent mt-2">Intelligent Scanning</span>
                </h2>
                
                <p className="text-text-secondary mb-8 text-lg leading-relaxed">
                  上传营养补充剂标签照片，AI瞬间识别成分并生成专业分析报告
                  <span className="block mt-2 text-sm text-text-accent">Professional OCR + GPT-4 Analysis</span>
                </p>
                
                {/* Upload Component */}
                <FileUpload
                  onUpload={(file) => {
                    console.log('File uploaded:', file.name);
                    // TODO: Implement OCR processing in Week 2
                  }}
                  maxSize={10 * 1024 * 1024} // 10MB
                  acceptedTypes={['.jpg', '.jpeg', '.png', '.webp']}
                />
              </div>
            </div>

            {/* 🔍 Search Section - Pure Encapsulations Style */}
            <div className="medical-card p-10 group">
              <div className="text-center">
                <div className="relative mx-auto flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-vitality-green to-vitality-orange mb-8 group-hover:scale-110 transition-all duration-500">
                  <Search className="h-10 w-10 text-white" />
                  <div className="absolute -inset-1 bg-gradient-to-br from-vitality-green to-vitality-orange rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
                </div>
                
                <h2 className="text-3xl font-bold text-text-primary mb-4">
                  🔍 智能搜索
                  <span className="block text-lg font-medium text-text-accent mt-2">Smart Database</span>
                </h2>
                
                <p className="text-text-secondary mb-8 text-lg leading-relaxed">
                  搜索权威营养品数据库，获得基于科学研究的专业建议
                  <span className="block mt-2 text-sm text-text-accent">Trusted Brands • Evidence-Based Data</span>
                </p>
                
                {/* Search Component */}
                <SearchBox
                  onSearch={(query) => {
                    console.log('Searching for:', query);
                    // TODO: Implement database search in Week 2
                  }}
                  suggestions={['Vitamin D3', 'Magnesium', 'Omega-3', 'Vitamin B12', 'Multivitamin', 'Probiotics']}
                  placeholder="Search supplements, brands, or ingredients..."
                  autoFocus={false}
                />
              </div>
            </div>
          </div>

          {/* ⚡ Vitality Features Bar */}
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="vitality-card p-6 text-center group cursor-pointer">
              <Zap className="h-8 w-8 mx-auto mb-4 group-hover:scale-125 transition-transform duration-300" />
              <div className="font-bold text-lg">⚡ 即时分析</div>
              <div className="text-sm opacity-90 mt-1">Instant Results</div>
              <div className="text-xs opacity-75 mt-2">3秒内完成专业分析</div>
            </div>
            
            <div className="vitality-card p-6 text-center group cursor-pointer" style={{ background: 'var(--gradient-trust)' }}>
              <Brain className="h-8 w-8 mx-auto mb-4 group-hover:scale-125 transition-transform duration-300" />
              <div className="font-bold text-lg">🧠 AI智能</div>
              <div className="text-sm opacity-90 mt-1">GPT-4 Powered</div>
              <div className="text-xs opacity-75 mt-2">最先进的AI分析引擎</div>
            </div>
            
            <div className="vitality-card p-6 text-center group cursor-pointer" style={{ background: 'var(--gradient-wellness)' }}>
              <Shield className="h-8 w-8 mx-auto mb-4 group-hover:scale-125 transition-transform duration-300" />
              <div className="font-bold text-lg">🛡️ 科学权威</div>
              <div className="text-sm opacity-90 mt-1">Evidence-Based</div>
              <div className="text-xs opacity-75 mt-2">基于NIH与Health Canada数据</div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-12 medical-card p-8">
            <h3 className="text-xl font-bold text-text-dark mb-6">How it works</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 font-bold text-lg mb-4">
                  1
                </div>
                <h4 className="font-medium text-gray-900 mb-2">Upload or Search</h4>
                <p className="text-sm text-gray-600">
                  Upload a supplement label image or search our curated database of popular supplements.
                </p>
              </div>
              
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 text-green-600 font-bold text-lg mb-4">
                  2
                </div>
                <h4 className="font-medium text-gray-900 mb-2">AI Analysis</h4>
                <p className="text-sm text-gray-600">
                  Our AI analyzes ingredients, dosages, and provides comprehensive nutritional insights.
                </p>
              </div>
              
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-purple-100 text-purple-600 font-bold text-lg mb-4">
                  3
                </div>
                <h4 className="font-medium text-gray-900 mb-2">Get Results</h4>
                <p className="text-sm text-gray-600">
                  Receive detailed analysis including benefits, dosage, safety, and personalized recommendations.
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <Shield className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Medical Disclaimer:</strong> This analysis is for educational purposes only and does not constitute medical advice. 
                  Always consult with a healthcare provider before starting any supplement regimen, especially if you have medical conditions or take medications.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
} 