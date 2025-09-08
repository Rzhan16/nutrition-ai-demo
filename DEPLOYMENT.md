# 🚀 Quick Deployment Guide

## Option 1: Vercel (Recommended - Free & Fast)

### Method A: Web Interface (Easiest)
1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
2. Click "New Project" 
3. Import your `nutrition-ai-demo` repository
4. Vercel will auto-detect Next.js settings
5. Click "Deploy" 
6. Your site will be live at `https://nutrition-ai-demo-[random].vercel.app`

### Method B: CLI (If you prefer terminal)
```bash
# Already installed: npm install -g vercel
vercel login  # Follow prompts to login
vercel --prod # Deploy to production
```

## Option 2: Netlify (Alternative)

1. Go to [netlify.com](https://netlify.com) and sign up
2. Click "New site from Git"
3. Connect GitHub and select `nutrition-ai-demo`
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
5. Click "Deploy site"

## Option 3: Railway (Backend-Friendly)

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `nutrition-ai-demo`
4. Railway auto-detects and deploys Next.js

## 🔧 After Deployment

1. **Copy your live URL** (e.g., `https://nutrition-ai-demo-abc123.vercel.app`)
2. **Update GitHub repository**:
   ```bash
   gh repo edit --homepage "YOUR_LIVE_URL_HERE"
   ```
3. **Update README.md** - Replace the demo link with your actual URL
4. **Share your live website!** 🎉

## 💡 Pro Tips

- **Vercel** is fastest for Next.js projects
- **Free tier** includes custom domains
- **Automatic deployments** on every Git push
- **Preview deployments** for branches/PRs

---

Your professional AI nutrition app will be live in under 5 minutes! 🚀 