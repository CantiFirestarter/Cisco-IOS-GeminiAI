# Deployment Guide

## Vercel Deployment Fix

This app now uses Vercel serverless functions to keep your API key secure.

### Setup Steps:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variable in Vercel:**
   - Go to your Vercel project settings
   - Navigate to "Environment Variables"
   - Add a new variable:
     - Name: `API_KEY`
     - Value: Your Google Gemini API key
   - Apply to all environments (Production, Preview, Development)

3. **Deploy:**
   ```bash
   vercel --prod
   ```

### What Changed:

- ✅ Created `/api/gemini.ts` - serverless function handling API calls
- ✅ Updated `geminiService.ts` - now calls the API route instead of direct Gemini calls
- ✅ Updated `vercel.json` - properly routes API requests
- ✅ Added `@vercel/node` dependency for TypeScript support in serverless functions

### Security Notes:

- ✅ API key is now stored server-side only
- ✅ No client-side exposure of sensitive credentials
- ✅ CORS properly configured for your frontend

### Local Development:

Create a `.env` file in the root directory:
```
API_KEY=your_gemini_api_key_here
```

Run the development server:
```bash
vercel dev
```

This will simulate the Vercel environment locally with serverless functions.
