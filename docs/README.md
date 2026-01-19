# Cisco CLI AI Expert - Documentation Index

Welcome to the official documentation folder for the Cisco CLI AI Expert. This directory contains legal and technical reference materials.

## Available Documents

- [Architecture Documentation](./ARCHITECTURE.md): Deep dive into the technical design and data flow.
- [Roadmap](./ROADMAP.md): Strategic vision and upcoming features.
- [Privacy Policy](./PRIVACY_POLICY.md): Details on how we handle user data and our local-first architecture.
- [Terms of Service](./TERMS_OF_SERVICE.md): Rules and guidelines for using the application.

## About the Project

Cisco CLI AI Expert is a deterministic AI-powered assistant designed to assist network engineers with Cisco IOS, IOS XE, and IOS XR command syntax and troubleshooting.

### Technical Highlights
- **Engine**: Powered by Google Gemini 3 (Pro/Flash).
- **Architecture**: Local-first storage with optional Google Drive cloud sync.
- **Safety**: Built-in Research Mode for live documentation verification via Google Search Grounding.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/12PIoS8fDW6IWGhyn65VWatg-pGVro36G

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`