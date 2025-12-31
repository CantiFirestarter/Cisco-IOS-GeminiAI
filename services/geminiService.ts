
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

export const getCiscoCommandInfo = async (query: string, imageBase64?: string, modelId: string = 'gemini-3-pro-preview') => {
  // Always initialize with named parameter 'apiKey'
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Use gemini-3-pro-image-preview for search grounding tasks
  const activeModel = modelId.includes('pro') ? 'gemini-3-pro-image-preview' : modelId;
  
  const contents: any[] = [];
  const parts: any[] = [{ text: query }];
  
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64.split(',')[1] || imageBase64
      }
    });
  }
  
  contents.push({ parts });

  // Only models in the 3 and 2.5 series support thinkingConfig
  const isComplex = query.length > 80 || /troubleshoot|design|architecture|bgp|ospf/i.test(query);
  const thinkingBudget = activeModel.includes('pro') ? 16000 : (activeModel.includes('flash') ? 8000 : 0);

  try {
    const response = await ai.models.generateContent({
      model: activeModel,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        tools: activeModel.includes('pro') ? [{ googleSearch: {} }] : undefined,
        thinkingConfig: isComplex && thinkingBudget > 0 ? { thinkingBudget } : undefined,
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

    // Directly access .text property
    const responseText = response.text;
    if (!responseText) throw new Error("Empty response from Cisco Intelligence Node");

    const result = JSON.parse(responseText.trim());

    // Extract grounding sources
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

export const getDynamicSuggestions = async (history: string[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = history.length > 0 
    ? `Based on these Cisco queries: [${history.join(', ')}], suggest 4 relevant commands/topics under 30 chars.`
    : "Suggest 4 core Cisco CLI topics (VLANs, OSPF, BGP, SSH).";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "Return a JSON array of 4 strings.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    return JSON.parse(response.text || '[]');
  } catch (error) {
    return [
      'BGP neighbor configuration', 
      'OSPF areas on IOS XR', 
      'VLAN interface setup', 
      'Show spanning-tree details'
    ];
  }
};
