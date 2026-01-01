
import { Modality } from "@google/genai";

/**
 * Fetches command information from Gemini API via serverless function
 */
export const getCiscoCommandInfo = async (query: string, imageBase64?: string, model: string = 'gemini-3-pro-preview', forceSearch: boolean = false) => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        imageBase64,
        model,
        forceSearch
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed: ${response.status}`);
    }

    const result = await response.json();
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
  const prompt = history.length > 0 
    ? `Based on recent queries: [${history.join(', ')}], suggest 4 professional Cisco follow-ups.`
    : "Suggest 4 foundational Cisco CLI topics.";

  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'suggestions',
        query: prompt
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch suggestions: ${response.status}`);
    }

    const data = await response.json();
    return data.suggestions || ['BGP neighbor config', 'OSPF XR setup', 'VLAN interface', 'Show spanning-tree'];
  } catch (error) {
    console.error("Suggestions API Error:", error);
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
