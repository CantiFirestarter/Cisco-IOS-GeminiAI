import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_INSTRUCTION = `
You are an expert Cisco AI assistant (Cisco CLI Expert).
Your role is to provide precise technical documentation for Cisco IOS, IOS XE, and IOS XR.

RESEARCH PROTOCOL:
- If a user asks about a specific command, sub-command, or keyword (e.g., 'ipv6 dhcp server automatic'), and there is any ambiguity, you MUST use the googleSearch tool to find the official Cisco documentation or White Papers.
- Pay extremely close attention to version-specific differences between IOS XE and IOS XR.

CONFIGURATION CHECKLIST:
- You MUST provide a 'checklist' section.
- This should be a step-by-step bulleted list of:
  1. Prerequisites (e.g., 'ip routing' must be enabled).
  2. Mandatory preceding commands.
  3. Post-configuration verification.

SECURITY PROTOCOL (MANDATORY):
- You MUST provide a 'security' section for every query.
- Identify if the command is deprecated or insecure (e.g., Telnet, HTTP, clear-text SNMP).
- Suggest hardening steps (e.g., using 'secret' instead of 'password', access-lists to restrict management access).
- Mention any impact on Control Plane Policing (CoPP) or CPU impact for debug commands.

TROUBLESHOOTING & VERIFICATION:
- You MUST provide a 'troubleshooting' section.
- This section should include common error messages and a bulleted list of 'show' and 'debug' commands.

SPELL CHECK & SYNTAX CORRECTION:
- Detect typos in CLI commands. Provide the corrected version in the 'correction' field.

VISUAL ANALYSIS:
- If the user provides an image, analyze it for CLI output or topology.

FORMATTING RULES:
- IMPORTANT: In 'description', 'usageContext', 'checklist', 'options', 'notes', 'troubleshooting', and 'security', you MUST wrap ALL CLI commands, keywords, and variables in backticks (\x60).
- 'checklist', 'options', 'troubleshooting', and 'security' should be bulleted lists where commands are in backticks.
- Syntax and examples must be pure text with standard CLI prompts.
- Always return a JSON object.
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, imageBase64, model = 'gemini-3-pro-preview', forceSearch = false, action, text } = req.body;

    if (!process.env.API_KEY) {
      return res.status(500).json({ error: 'API_KEY not configured in environment variables' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Handle text-to-speech
    if (action === 'tts') {
      if (!text) {
        return res.status(400).json({ error: 'Text is required for TTS' });
      }

      const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say in a professional, technical voice: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        return res.status(500).json({ error: 'No audio data received' });
      }

      return res.status(200).json({ audioBase64: base64Audio, sampleRate: 24000, channels: 1 });
    }

    // Handle suggestions
    if (action === 'suggestions') {
      const suggestionResponse = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: [{
          parts: [{
            text: `Provide 4 concise Cisco CLI suggestions based on: "${query || 'general Cisco networking'}". Return JSON array of strings.`
          }]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const suggestions = JSON.parse(suggestionResponse.text);
      return res.status(200).json({ suggestions });
    }

    // Handle command info
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const contents: any[] = [];
    const promptText = forceSearch
      ? `STRICT TECHNICAL SEARCH REQUIRED: Deep dive into Cisco documentation for syntax, security hardening, and troubleshooting: ${query}`
      : query;

    const parts: any[] = [{ text: promptText }];

    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64.split(',')[1] || imageBase64
        }
      });
    }

    contents.push({ parts });

    const isComplex = forceSearch || query.length > 80 || query.toLowerCase().includes('design') || query.toLowerCase().includes('troubleshoot');

    const response = await ai.models.generateContent({
      model: model,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        tools: (model.includes('pro') || forceSearch) ? [{ googleSearch: {} }] : undefined,
        thinkingConfig: (model.includes('pro') || model.includes('flash')) && isComplex ? { thinkingBudget: 12000 } : undefined,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reasoning: { type: Type.STRING },
            deviceCategory: { type: Type.STRING },
            commandMode: { type: Type.STRING },
            syntax: { type: Type.STRING },
            description: { type: Type.STRING },
            usageContext: { type: Type.STRING },
            checklist: { type: Type.STRING },
            options: { type: Type.STRING },
            troubleshooting: { type: Type.STRING },
            security: { type: Type.STRING },
            notes: { type: Type.STRING },
            examples: { type: Type.STRING },
            correction: { type: Type.STRING },
          },
          required: ["reasoning", "deviceCategory", "commandMode", "syntax", "description", "usageContext", "checklist", "options", "troubleshooting", "security", "notes", "examples"]
        }
      },
    });

    const data = JSON.parse(response.text);
    return res.status(200).json(data);

  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({
      error: 'Failed to process request',
      message: error.message || 'Unknown error'
    });
  }
}
