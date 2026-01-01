
import { GoogleGenAI, Type, Modality } from "@google/genai";

// Escaped backticks inside the template literal to prevent syntax errors and premature string termination
// Using \x60 for the literal backtick character to ensure the string is parsed correctly
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

/**
 * Fetches command information from Gemini with optional image analysis and search grounding.
 */
export const getCiscoCommandInfo = async (query: string, imageBase64?: string, model: string = 'gemini-3-pro-preview', forceSearch: boolean = false) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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

  try {
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

    const result = JSON.parse(response.text);

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      result.sources = chunks
        .filter(c => c.web)
        .map(c => ({ title: c.web.title, uri: c.web.uri }));
    }

    return result;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

/**
 * Generates dynamic follow-up suggestions based on session history.
 */
export const getDynamicSuggestions = async (history: string[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = history.length > 0 
    ? `Based on recent queries: [${history.join(', ')}], suggest 4 professional Cisco follow-ups.`
    : "Suggest 4 foundational Cisco CLI topics.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "Return only a JSON array of strings.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    return ['BGP neighbor config', 'OSPF XR setup', 'VLAN interface', 'Show spanning-tree'];
  }
};

// --- TTS Logic ---

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const synthesizeSpeech = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
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

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data received");

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const audioBuffer = await decodeAudioData(
    decodeBase64(base64Audio),
    audioCtx,
    24000,
    1,
  );

  return { audioBuffer, audioCtx };
};
