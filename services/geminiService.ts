import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are an expert Cisco AI assistant (Cisco CLI Expert).
Your role is to provide precise technical documentation for Cisco IOS, IOS XE, and IOS XR.

SPELL CHECK & SYNTAX CORRECTION:
- Detect typos in CLI commands. Provide the corrected version in the 'correction' field.

VISUAL ANALYSIS:
- If an image is provided, analyze it for CLI output, log messages, or topology.

GROUNDING & SEARCH:
- Use Google Search for the most current Cisco documentation, bug IDs, or firmware versions.
- Extract source titles and URLs into the response.

FORMATTING RULES:
- IMPORTANT: Wrap ALL CLI commands, keywords, parameters, and variables in backticks (\`).
- Use **bold** for major headings.
- 'options' MUST be a bulleted list with commands in backticks (\`).
- Syntax and examples must use standard CLI prompts (e.g., Router(config)#).
- Always return a JSON object.
`;

/**
 * Fetches command information from Gemini with optional search grounding and image analysis.
 * Uses gemini-3-pro-preview for complex tasks to ensure structured JSON output support.
 */
export const getCiscoCommandInfo = async (query: string, imageBase64?: string, modelId: string = 'gemini-3-pro-preview') => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY environment variable is not defined.");

  // Initialize client right before the call to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey });
  
  // Use gemini-3-pro-preview for complex reasoning and search; gemini-3-pro-image-preview is optimized for image gen and lacks JSON support
  const activeModel = modelId.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  
  const parts: any[] = [{ text: query }];
  
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64.split(',')[1] || imageBase64
      }
    });
  }
  
  // Define thinking budget based on the selected model family (Max: Pro=32768, Flash=24576)
  const isComplex = query.length > 80 || /troubleshoot|design|architecture|bgp|ospf/i.test(query);
  const thinkingBudget = activeModel.includes('pro') ? 32768 : 24576;

  try {
    const response = await ai.models.generateContent({
      model: activeModel,
      contents: [{ parts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        // Only enable googleSearch for Pro models to prioritize speed on Flash/Lite options
        tools: activeModel.includes('pro') ? [{ googleSearch: {} }] : undefined,
        thinkingConfig: isComplex ? { thinkingBudget } : undefined,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reasoning: { type: Type.STRING },
            deviceCategory: { type: Type.STRING },
            commandMode: { type: Type.STRING },
            syntax: { type: Type.STRING },
            description: { type: Type.STRING },
            usageContext: { type: Type.STRING },
            options: { type: Type.STRING },
            notes: { type: Type.STRING },
            examples: { type: Type.STRING },
            correction: { type: Type.STRING },
          },
          required: ["reasoning", "deviceCategory", "commandMode", "syntax", "description", "usageContext", "options", "notes", "examples"]
        }
      },
    });

    const responseText = response.text;
    if (!responseText) throw new Error("Empty response from Cisco Intelligence Node");

    const result = JSON.parse(responseText.trim());

    // Extract grounding sources from Metadata if search was used
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      result.sources = chunks
        .filter(c => c.web)
        .map(c => ({ title: c.web.title, uri: c.web.uri }));
    }

    return result;
  } catch (error) {
    console.error("Cisco Intelligence Error:", error);
    throw error;
  }
};

/**
 * Generates dynamic command suggestions based on the user's recent chat history.
 */
export const getDynamicSuggestions = async (history: string[]) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return DEFAULT_SUGGESTIONS;

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = history.length > 0 
    ? `Based on these Cisco queries: [${history.join(', ')}], suggest 4 relevant commands/topics under 30 chars.`
    : "Suggest 4 core Cisco CLI topics (VLANs, OSPF, BGP, SSH).";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "Return a JSON array of exactly 4 strings.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    return JSON.parse(response.text || '[]');
  } catch (error) {
    return DEFAULT_SUGGESTIONS;
  }
};

const DEFAULT_SUGGESTIONS = [
  'BGP neighbor configuration', 
  'OSPF areas on IOS XR', 
  'VLAN interface setup', 
  'Show spanning-tree details'
];