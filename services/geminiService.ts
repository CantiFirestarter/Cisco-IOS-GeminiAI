
import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are an expert Cisco AI assistant with comprehensive knowledge of Cisco IOS, IOS XE, and IOS XR commands.
Your role is to provide precise technical documentation for networking engineers.

Provide a detailed response for the requested command or task, including:
- reasoning: Your brief analysis of the command.
- syntax: The full command syntax.
- description: What the command does.
- usageContext: Where and when to use it (platforms, modes).
- options: Explanation of parameters and flags.
- notes: Important caveats or best practices.
- examples: Practical CLI examples.

FORMATTING RULES:
1. Use **bold** for keywords and \`code\` for variables in 'description', 'options', 'notes', and 'usageContext'.
2. NEVER use markdown formatting (like **bold**, *italics*, or \`code\`) inside the 'syntax' or 'examples' fields. These fields must be pure text.
3. COMMAND MODES: For every command listed in 'syntax' and 'examples', you MUST prefix the command with the standard Cisco CLI prompt to indicate the required Command Mode.
   - User EXEC: 'Router>'
   - Privileged EXEC: 'Router#'
   - Global Configuration: 'Router(config)#'
   - Interface Configuration: 'Router(config-if)#'
   - Router Configuration: 'Router(config-router)#'
   - Line Configuration: 'Router(config-line)#'
4. In 'examples', each step of the process MUST be on its own new line, including entering the configuration modes.
   Example:
   Router# configure terminal
   Router(config)# interface GigabitEthernet0/1
   Router(config-if)# description Uplink to Core
5. ALWAYS return the response as a JSON object.
`;

export const getCiscoCommandInfo = async (query: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: query }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reasoning: { type: Type.STRING },
            syntax: { type: Type.STRING },
            description: { type: Type.STRING },
            usageContext: { type: Type.STRING },
            options: { type: Type.STRING },
            notes: { type: Type.STRING },
            examples: { type: Type.STRING },
          },
          required: ["reasoning", "syntax", "description", "usageContext", "options", "notes", "examples"]
        }
      },
    });

    return JSON.parse(response.text) as any;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
