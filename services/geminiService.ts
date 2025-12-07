import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Message, PostcardData } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const MODEL_NAME = 'gemini-2.5-flash';

export const startChatWithImage = async (base64Image: string): Promise<string> => {
  try {
    const prompt = `
      你是我最好的朋友，现在的氛围很轻松、治愈。
      请仔细看这张图片，用一种温暖、自然、像老朋友聊天的语气跟我说话。
      
      规则：
      1. 语气：亲切、随意、温暖，不要高冷，不要太文艺或者说教。就像我们坐在草地上聊天一样。
      2. 每次回复限制在60个汉字以内。
      3. 第一句话直接根据图片内容开启一个轻松的话题。
      4. 让我感到被陪伴。
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.split(',')[1] // Remove header
            }
          },
          { text: prompt }
        ]
      }
    });

    return response.text || "嘿，这张图真有意思，是你拍的吗？";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "信号好像不太好，能再说一遍吗？";
  }
};

export const sendMessage = async (history: Message[], newMessage: string, base64Image: string): Promise<string> => {
  try {
    let promptContext = "以下是我们之前的对话（你是我最好的朋友）：\n";
    history.forEach(h => {
      promptContext += `${h.role === 'user' ? '我' : '你'}: ${h.text}\n`;
    });
    promptContext += `\n我现在说: "${newMessage}"\n请继续以朋友的身份回复，轻松自然，不要长篇大论（60字内）。`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
           {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.split(',')[1]
            }
          },
          { text: promptContext }
        ]
      }
    });

    return response.text || "...";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "刚才走神了，你说什么？";
  }
};

export const generatePostcardSummary = async (history: Message[], base64Image: string): Promise<PostcardData> => {
  // Default fallback data
  const fallbackData: PostcardData = {
    summary: "把此刻的微风，寄给未来的你。",
    mood: "宁静",
    keywords: ["记忆", "流年", "此刻"]
  };

  try {
    let conversationText = "";
    history.forEach(h => {
      conversationText += `${h.role}: ${h.text}\n`;
    });

    const prompt = `
      请分析我们刚才的对话（如下），生成一个JSON对象，包含以下三个字段：
      
      1. "summary": 一句极具治愈感的短句，适合印在明信片上。不要太长（30字以内），要像诗一样美，但不要矫情。
      2. "mood": 用两个汉字形容我（用户）当前的心情或对话的氛围（例如：宁静、怀旧、喜悦）。
      3. "keywords": 提取3个关于对话内容的关键词（例如：夏天、海边、猫咪）。

      对话内容：
      ${conversationText}
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            mood: { type: Type.STRING },
            keywords: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text);
      // Merge with fallback to ensure all fields exist
      return {
        summary: parsed.summary || fallbackData.summary,
        mood: parsed.mood || fallbackData.mood,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : fallbackData.keywords
      };
    }
    return fallbackData;

  } catch (error) {
    console.error("Gemini Postcard Error:", error);
    return fallbackData;
  }
};