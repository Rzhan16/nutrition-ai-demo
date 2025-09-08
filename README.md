# Nutrition AI Demo - AI-Powered Supplement Analysis

A professional AI-powered nutrition supplement analysis application built with Next.js 14 and OpenAI GPT-4. Scan supplement labels, get comprehensive nutritional insights, and make informed health decisions.

## 🚀 Live Demo

**[🌟 VIEW LIVE DEMO](https://nutrition-ai-demo-huxdy4fol-raymonds-projects-b281a579.vercel.app)** 

Experience the stunning Trust & Vitality Fusion design with:
- ✨ Bilingual hero with gradient text (智能营养 AI Analysis)
- ⚡ Dynamic 3D gradient icons with glow effects
- 🎯 Vitality cards with bounce animations
- 🔬 Medical-grade Pure Encapsulations aesthetic
- 📱 Mobile-optimized Sports Research energy

Local development:
```bash
npm run dev
# Open http://localhost:3000
```

## 🎯 Project Overview

This demo application showcases an AI-powered nutrition analysis platform designed for health-conscious individuals and fitness enthusiasts. It provides instant supplement analysis through OCR scanning and database search, delivering professional-grade nutritional insights.

### Key Features

- **OCR Label Scanning**: Upload supplement images for instant text extraction and ingredient identification
- **AI-Powered Analysis**: Comprehensive nutritional breakdowns using OpenAI GPT-4
- **Search Database**: Search curated supplement database with popular brands
- **Professional Reports**: 8-point analysis format in English and Chinese
- **Safety Compliance**: Evidence-based recommendations with interaction warnings
- **Mobile-First Design**: Responsive, accessible, medical-grade UI

## 🏗️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icons
- **Framer Motion** - Smooth animations

### AI & Backend
- **OpenAI GPT-4** - AI analysis engine
- **Tesseract.js** - OCR processing (planned)
- **Prisma ORM** - Database management
- **SQLite** - Demo database

### Development
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Static type checking

## 📋 Analysis Format

Each supplement receives a comprehensive 8-point analysis:

1. **基本介绍 (Basic Introduction)** - Overview and primary purpose
2. **主要益处 (Primary Benefits)** - Evidence-based benefits with research citations
3. **推荐摄入量 (RDA)** - Recommended daily allowance for adults
4. **可耐受最高摄入量 (UL)** - Safe upper limits for consumption
5. **常见膳食来源 (Dietary Sources)** - Natural food sources
6. **补充剂形式 (Supplement Forms)** - Different forms and bioavailability
7. **适合关注的情况 (Usage Scenarios)** - When supplementation is beneficial
8. **风险与注意事项 (Risks & Precautions)** - Safety warnings and interactions

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn package manager
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/nutrition-ai-demo.git
   cd nutrition-ai-demo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your configuration:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   DATABASE_URL="file:./dev.db"
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
nutrition-ai-demo/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx           # Landing page
│   │   ├── layout.tsx         # Root layout
│   │   ├── globals.css        # Global styles
│   │   └── analyze/           # Analysis page
│   ├── components/            # React components
│   │   ├── layout/           # Layout components
│   │   ├── upload/           # File upload components
│   │   └── analysis/         # Analysis display components
│   └── lib/                   # Utilities and types
│       ├── types.ts          # TypeScript interfaces
│       └── utils.ts          # Helper functions
├── public/                    # Static assets
├── docs/                      # Documentation
└── package.json              # Dependencies and scripts
```

## 🎨 Design System

### Colors
- **Primary**: Blue tones for trust and professionalism
- **Health**: Green tones for wellness and nature
- **Accent**: Complementary colors for highlights
- **Medical**: Clean whites and grays for medical-grade appearance

### Typography
- **Font**: Inter for modern, readable interface
- **Hierarchy**: Clear heading structure for accessibility
- **Language**: Bilingual support (English/Chinese)

### Components
- **Medical Cards**: Elevated cards with professional shadows
- **Buttons**: Primary and secondary button styles
- **Forms**: Accessible form controls with validation
- **Icons**: Consistent Lucide React icon usage

## 🔒 Privacy & Security

- **Local Storage**: Sensitive data stored locally
- **Encrypted Profiles**: User data encryption
- **GDPR Compliance**: Privacy-focused design
- **Medical Disclaimers**: Clear legal disclaimers
- **Data Minimization**: Collect only essential information

## 📊 Demo Features

### Week 1: Foundation (Completed)
- ✅ Next.js 14 setup with TypeScript
- ✅ Tailwind CSS configuration
- ✅ Professional landing page
- ✅ Analysis page interface
- ✅ Navigation and layout components
- ✅ Error boundary implementation

### Week 2: Core Features (Planned)
- 🔄 OCR implementation with Tesseract.js
- 🔄 File upload with drag & drop
- 🔄 Search functionality
- 🔄 Database integration

### Week 3: AI Integration (Planned)
- 🔄 OpenAI GPT-4 integration
- 🔄 Professional analysis prompts
- 🔄 Structured response parsing
- 🔄 User tracking system

### Week 4: Polish & Deploy (Planned)
- 🔄 Testing and QA
- 🔄 Performance optimization
- 🔄 Deployment to Vercel
- 🔄 Documentation completion

## 🚨 Important Disclaimers

⚠️ **Medical Disclaimer**: This application is for educational purposes only and does not constitute medical advice. Always consult with a healthcare provider before starting any supplement regimen, especially if you have medical conditions or take medications.

⚠️ **Demo Purpose**: This is a demonstration application. AI-generated content may contain errors or omissions. Do not rely on this information for medical decisions.

## 📝 Development Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. **Create a Vercel account** at [vercel.com](https://vercel.com)
2. **Connect your GitHub repository**:
   ```bash
   npm install -g vercel
   vercel login
   vercel --prod
   ```
3. **Set environment variables** in Vercel dashboard:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `DATABASE_URL`: Database connection string (when implemented)

### Deploy to Netlify

1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `.next`
4. Add environment variables in Netlify dashboard

### Deploy to Railway

1. Connect GitHub repository to Railway
2. Railway will auto-detect Next.js and deploy
3. Add environment variables in Railway dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎓 Built for Health & Wellness

This project showcases modern web development practices and AI integration for health technology applications, focusing on evidence-based nutrition guidance and professional supplement analysis.

## 📞 Support

For questions, suggestions, or support:
- Create an issue on GitHub
- Contact the development team
- Review the documentation

---

**⚡ Powered by Next.js 14, OpenAI GPT-4, and modern web technologies**
