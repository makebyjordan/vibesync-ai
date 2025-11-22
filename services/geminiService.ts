
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AudioAnalysis, Language } from '../types';

// Initialize lazily or safely
const getAI = () => {
  const key = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!key || key === 'PLACEHOLDER') {
    console.warn("Gemini API Key is missing or invalid.");
    return null;
  }
  return new GoogleGenAI({ apiKey: key });
};

// Schema for structured output
const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    detectedGenre: { type: Type.STRING },
    mood: { type: Type.STRING },
    tempo: { type: Type.STRING },
    keyElements: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    vibeDescription: { type: Type.STRING },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          artist: { type: Type.STRING },
          title: { type: Type.STRING },
          reason: { type: Type.STRING },
          similarityScore: { type: Type.NUMBER }
        },
        required: ["artist", "title", "reason", "similarityScore"]
      }
    }
  },
  required: ["detectedGenre", "mood", "tempo", "keyElements", "vibeDescription", "recommendations"]
};

export const analyzeAudioContent = async (base64Audio: string, language: Language): Promise<Omit<AudioAnalysis, 'id' | 'timestamp'>> => {
  try {
    const langInstruction = language === 'es' ? "in Spanish (Español)" : "in English";

    const ai = getAI();
    if (!ai) {
      // Return mock data if no API key
      return {
        detectedGenre: "Unknown (No API Key)",
        mood: "N/A",
        tempo: "0 BPM",
        keyElements: ["Missing API Key"],
        vibeDescription: "Please add a valid GEMINI_API_KEY to your .env file to enable AI analysis.",
        recommendations: []
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/wav', // Assuming we send WAV from recorder
              data: base64Audio
            }
          },
          {
            text: `Listen to this audio. Analyze its tempo, rhythm, style, and flow. If it's music, identify the genre and mood. Then, recommend 4 real, existing songs that have the exact same 'vibe', 'flow' or 'groove'. Ensure these songs exist on YouTube. For example, if it's funky with a specific vocal style, find matches. Provide a JSON response. IMPORTANT: Provide all text fields (mood, detectedGenre, vibeDescription, reasons) ${langInstruction}.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        systemInstruction: `You are a world-class musicologist and DJ. You specialize in finding deep cuts and perfect matches based on rhythm, production style, and emotional context. You must respond ${langInstruction}.`
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No response text");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const chatWithAssistant = async (history: { role: string, content: string }[], message: string, language: Language) => {
  const langInstruction = language === 'es' ? "Speak in Spanish (Español)." : "Speak in English.";

  const ai = getAI();
  if (!ai) return "Please configure your GEMINI_API_KEY to chat.";

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `You are VibeBot, a cool, energetic music assistant embedded in the VibeSync app. Keep answers short, punchy, and helpful. ${langInstruction}`
    },
    history: history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    }))
  });

  const result = await chat.sendMessage({ message });
  return result.text;
};
