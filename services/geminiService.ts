
import { GoogleGenAI, Type, Modality } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are an expert Cisco AI assistant (Cisco CLI Expert).
Your role is to provide precise technical documentation for Cisco IOS, IOS XE, and IOS XR.

SCOPE ENFORCEMENT:
- You are strictly limited to Cisco networking, CLI commands, network design, and troubleshooting.
- If a query is NOT related to networking, infrastructure, or Cisco technology, set 'isOutOfScope' to true.

RESEARCH PROTOCOL:
- If a user asks about a specific command and there is ambiguity, you MUST use the googleSearch tool.

FORMATTING RULES (CRITICAL - NO DEVIATION ALLOWED):
1. Wrap ALL CLI commands, keywords, and variables in backticks (\`).
2. Use angle brackets for variables and placeholders (e.g., <vlan-id>, <ip-address>).
3. If a variable contains choices, use a pipe (|) separator, NEVER a slash (/).
   - INCORRECT: <in/out>, <up/down>
   - CORRECT: <in|out>, <up|down>
4. NEVER use single quotes ('variable') or parentheses (command) around commands or variables in ANY field.
5. For the 'options' field, use the format: \`- \`command\` : description\`.
6. Bold important networking concepts and key terms within the 'description' and 'usageContext' fields using double asterisks.
7. In checklists, provide the command directly or after a colon using backticks.
8. Examples MUST use standard CLI prompts and strictly follow the angle-bracket rule for placeholders.
9. Always return a JSON object.
`;

export const getCiscoCommandInfo = async (
  query: string, 
  fileData?: { data: string, mimeType: string }, 
  model: string = 'gemini-3-pro-preview', 
  forceSearch: boolean = false,
  voiceInput: boolean = false
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
            isOutOfScope: { type: Type.BOOLEAN },
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
          required: ["reasoning", "isOutOfScope", "deviceCategory", "commandMode", "syntax", "description", "usageContext", "checklist", "options", "troubleshooting", "security", "notes", "examples"]
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
  
  // Ensure the context is running (required by some browsers after instantiation)
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  
  const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), audioCtx, 24000, 1);
  return { audioBuffer, audioCtx };
};
