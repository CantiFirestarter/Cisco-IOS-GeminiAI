# Architecture Documentation - Cisco CLI AI Expert

This document outlines the technical architecture, data flow, and design principles of the Cisco CLI AI Expert application.

## 1. High-Level Overview

The Cisco CLI AI Expert is a **Client-Side Only (CSO)** web application. It operates without a custom backend, interacting directly with the Google Gemini API and Google Drive API from the user's browser.

### Core Philosophy: Local-First
- **Privacy by Design**: All user command history and configurations are stored in `LocalStorage` by default.
- **Sovereignty**: No technical queries or network logs are stored on developer-controlled servers.
- **Optional Sync**: Cloud synchronization is handled via the user's personal Google Drive (hidden `appDataFolder`).

## 2. Technology Stack

- **Frontend Framework**: React 19 (ESM based).
- **Build System**: Vite 6.
- **Styling**: Tailwind CSS (Utility-first).
- **AI Engine**: Google Gemini API via `@google/genai` SDK.
    - **Pro Model**: Used for complex reasoning and Search Grounding.
    - **Flash Model**: Used for speed and dynamic suggestion generation.
- **Persistence**: 
    - `window.localStorage` (Primary).
    - Google Drive API v3 (Sync).
- **Communication**: WebSockets (Live API) & REST (Standard Generation).

## 3. Component Architecture

### 3.1 `App.tsx` (The Orchestrator)
The root component manages the global state:
- **Message History**: Array of `ChatMessage` objects.
- **Session Management**: Google Auth state and API key validation.
- **UI State**: View switching (Home vs. Chat), loading states, and theme.

### 3.2 `geminiService.ts` (The Intelligence Layer)
Handles all communication with Google Generative AI:
- **System Instructions**: Enforces "Determinism Protocols" (fixed terminology, standard syntax).
- **Grounding**: Implements `googleSearch` tool for live documentation verification.
- **Structured Output**: Uses `responseSchema` (JSON) to ensure consistent data structures for the UI.

### 3.3 `ResultCard.tsx` (The Render Engine)
A specialized component for parsing technical CLI data:
- **Syntax Highlighting**: Custom regex-based highlighting for Cisco keywords and variables.
- **Interactive Elements**: Copy-to-clipboard, text-to-speech (TTS) for accessibility, and logic reasoning toggles.

## 4. Deployment & Hosting

The application is built as a static site and can be deployed to modern edge platforms.

### 4.1 Vercel
- Handled via `vercel.json` for routing and headers.
- Automatic CD via Git integration.

### 4.2 Cloudflare Workers
- Handled via `wrangler.json` and `worker.ts`.
- Uses the **Workers + Assets** architecture.
- The `worker.ts` script manages SPA routing (404 fallback to `index.html`) and injects security headers.

## 5. Data Flow

1. **Input**: User enters a query or uploads a file/image.
2. **Context Assembly**: `App.tsx` bundles the query with any attached media.
3. **AI Request**: `geminiService` calls Gemini with a deterministic configuration (`temp: 0.1`, `seed: 42`).
4. **Grounding (Optional)**: If Research Mode is active, Gemini performs a Google Search for the latest Cisco docs.
5. **JSON Parsing**: The SDK returns a structured JSON object defined by the application's TypeScript interfaces.
6. **Rendering**: `ResultCard` decomposes the JSON into logical sections (Syntax, Troubleshooting, Security, etc.).
7. **Persistence**: The new message is saved to `localStorage` and asynchronously patched to Google Drive.

## 6. Security & Privacy

### API Key Handling
- In development/sandbox environments, keys are managed via `process.env`.
- In production, the app integrates with Google AI Studio's key selection protocol to allow users to provide their own billed project keys.

### Authentication
- **OAuth 2.0**: Uses Google Services Identity (GSI) for secure, scoped access to Google Drive.
- **Scoped Permissions**: Only requests `drive.appdata` access, preventing the app from seeing the user's regular Drive files.

## 7. Determinism & Accuracy Protocols

To combat AI "hallucinations" in critical network environments:
- **Low Temperature**: Set to `0.1` to favor the most likely technical tokens.
- **Fixed Seed**: Ensures that identical prompts yield identical documentation responses.
- **Validation**: "Research Mode" forces the model to verify answers against live web results before responding.