
import { GoogleGenAI, Type, Modality } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are an expert Cisco AI assistant (Cisco CLI Expert).
Your role is to provide precise, consistent, and deterministic technical documentation and architectural guidance for Cisco IOS, IOS XE, and IOS XR.

OPERATIONAL MODES:
1. COMMAND REFERENCE MODE: If the user asks for a specific command or syntax. Provide the full grid of technical details.
2. TECHNICAL Q&A MODE: If the user asks a conceptual, design, or "How-to" question (e.g., "What is the difference between...", "How do I design..."). 
   - Set 'isTechnicalQuestion' to true.
   - Populate 'generalAnswer' with a detailed, structured technical explanation using Markdown.
   - Still provide 'examples' and 'troubleshooting' if applicable.
   - Set command-specific fields (like syntax) to "N/A" if they don't apply.

DETERMINISM ENFORCEMENT:
- You are a technical reference manual. Use technically accurate and concise standard phrasing.
- If a command's function is "Enables BGP routing," always use that exact phrase.

RESEARCH PROTOCOL:
- If a user asks about a specific command or a complex design scenario, you MUST use the googleSearch tool.

FORMATTING RULES (CRITICAL):
1. Wrap ALL CLI commands, keywords, and variables in backticks (\`), EXCEPT within the 'examples' field.
2. Use angle brackets for variables and placeholders (e.g., <vlan-id>).
3. Examples MUST use raw terminal text. NO backticks (\`) allowed in the 'examples' field.
4. Always return a JSON object.
`;

const getApiKey = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('cisco_expert_api_key');
    if (stored) return stored;
  }
  return process.env.API_KEY || '';
};

/**
 * Lightweight check to see if the provided API key works.
 */
export const validateApiKey = async (testKey: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: testKey });
    // Use the fastest model for a tiny check
    await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: 'ping' }] }],
      config: { maxOutputTokens: 1 }
    });
    return { success: true };
  } catch (error: any) {
    console.error("Validation Error:", error);
    return { success: false, message: error.message || "Invalid API Key" };
  }
};

export const getCiscoCommandInfo = async (
  query: string, 
  fileData?: { data: string, mimeType: string }, 
  model: string = 'gemini-3-pro-preview', 
  forceSearch: boolean = false,
  voiceInput: boolean = false
) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const contents: any[] = [];
  const promptText = forceSearch 
    ? `STRICT TECHNICAL SEARCH REQUIRED: Deep dive into Cisco documentation for syntax, security hardening, and troubleshooting: ${query}` 
    : query;
    
  const parts: any[] = [{ text: promptText }];
  
  if (fileData) {
    parts.push({
      inlineData: {
        mimeType: fileData.mimeType,
        data: fileData.data.split(',')[1] || fileData.data
      }
    });
  }
  
  contents.push({ parts });

  const isComplex = forceSearch || query.length > 80 || query.toLowerCase().includes('design') || query.toLowerCase().includes('troubleshoot') || query.toLowerCase().includes('difference');

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.1,
        seed: 42,
        tools: (model.includes('pro') || forceSearch) ? [{ googleSearch: {} }] : undefined,
        thinkingConfig: (model.includes('pro') || model.includes('flash')) && isComplex ? { thinkingBudget: 12000 } : undefined,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reasoning: { type: Type.STRING },
            isOutOfScope: { type: Type.BOOLEAN },
            isTechnicalQuestion: { type: Type.BOOLEAN },
            generalAnswer: { type: Type.STRING, description: "Main text for conceptual or design questions." },
            deviceCategory: { type: Type.STRING },
            commandMode: { type: Type.STRING },
            syntax: { type: Type.STRING },
            description: { type: Type.STRING },
            usageContext: { type: Type.STRING },
            usageGuidelines: { type: Type.STRING },
            checklist: { type: Type.STRING },
            options: { type: Type.STRING },
            troubleshooting: { type: Type.STRING },
            security: { type: Type.STRING },
            notes: { type: Type.STRING },
            examples: { type: Type.STRING },
            correction: { type: Type.STRING },
          },
          propertyOrdering: ["reasoning", "isOutOfScope", "isTechnicalQuestion", "generalAnswer", "deviceCategory", "commandMode", "syntax", "description", "usageContext", "usageGuidelines", "checklist", "options", "troubleshooting", "security", "notes", "examples", "correction"],
          required: ["reasoning", "isOutOfScope", "deviceCategory", "commandMode", "syntax", "description", "usageContext", "usageGuidelines", "checklist", "options", "troubleshooting", "security", "notes", "examples"]
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

export const getDynamicSuggestions = async (history: string[]) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const prompt = history.length > 0 
    ? `Based on recent queries: [${history.join(', ')}], suggest 4 professional Cisco follow-ups. Mix specific commands with high-level design questions.`
    : "Suggest 4 foundational Cisco CLI topics or technical questions.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "Return only a JSON array of strings. Be technically specific.",
        responseMimeType: "application/json",
        temperature: 0.1,
        seed: 42,
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return ['BGP neighbor config', 'OSPF vs EIGRP', 'SD-WAN basics', 'VLAN design best practices'];
  }
};

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
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
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
  
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  
  const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), audioCtx, 24000, 1);
  return { audioBuffer, audioCtx };
};
