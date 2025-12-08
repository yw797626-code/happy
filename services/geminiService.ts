import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Message, PostcardData } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const MODEL_NAME = 'gemini-2.5-flash';

// --- Image Chat Service ---
export const startChatWithImage = async (base64Image: string): Promise<string> => {
  try {
    const prompt = `
      你是我最好的朋友，现在的氛围很轻松、治愈。
      请仔细看这张图片，用一种温暖、自然、像老朋友聊天的语气跟我说话。
      
      规则：
      1. 语气：亲切、随意、温暖，不要高冷，不要太文艺或者说教。就像我们坐在草地上聊天一样。
      2. 长度控制：回复在40-60字左右，不要太短（避免冷淡），也不要太长（避免啰嗦）。
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

export const sendMessage = async (history: Message[], newMessage: string, base64Image: string | null): Promise<string> => {
  try {
    let promptContext = "以下是我们之前的对话（你是我最好的朋友）：\n";
    history.forEach(h => {
      promptContext += `${h.role === 'user' ? '我' : '你'}: ${h.text}\n`;
    });
    promptContext += `\n我现在说: "${newMessage}"\n请继续以朋友的身份回复，轻松自然。字数控制在40-60字左右，温暖且有回应感。`;

    const parts: any[] = [{ text: promptContext }];
    
    if (base64Image) {
        parts.unshift({
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.split(',')[1]
            }
        });
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts }
    });

    return response.text || "...";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "刚才走神了，你说什么？";
  }
};

// --- Therapy Chat Service ---
export const startTherapyChat = async (emotion: string): Promise<string> => {
    try {
        const prompt = `
          角色设定：你是一位权威但极其亲切、温暖的心理咨询师。
          情境：用户正感到"${emotion}"，他们点击了一片代表这个情绪的羽毛来寻求帮助。
          
          任务：
          1. 用最温柔、包容的语气开场。
          2. 肯定用户的情绪（例如："感到${emotion}是很正常的..."）。
          3. 轻轻地引导用户说出为什么会有这种感觉。
          4. 字数控制在40-60字，不要长篇大论，要像涓涓细流一样抚慰人心。
        `;
    
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: { text: prompt }
        });
    
        return response.text || "没关系，慢慢说，我在这里听着。";
      } catch (error) {
        console.error("Gemini Therapy Error:", error);
        return "如果你想聊聊，我随时都在。";
      }
}

export const sendTherapyMessage = async (history: Message[], newMessage: string, emotion: string): Promise<string> => {
    try {
        let promptContext = `角色：权威且温暖的心理咨询师。用户情绪：${emotion}。\n历史对话：\n`;
        history.forEach(h => {
          promptContext += `${h.role === 'user' ? '来访者' : '咨询师'}: ${h.text}\n`;
        });
        promptContext += `\n来访者现在说: "${newMessage}"\n请继续引导和疏导。语气要专业但充满人文关怀。不仅要倾听，还要给出一点点思考或安慰。字数40-60字。`;
    
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: { text: promptContext }
        });
    
        return response.text || "...";
      } catch (error) {
        console.error("Gemini Therapy Chat Error:", error);
        return "我在听，请继续。";
      }
}

export const generateOldPaperSummary = async (history: Message[], emotion: string): Promise<PostcardData> => {
    const fallbackData: PostcardData = {
        summary: "情绪如云烟，终会消散在风中。",
        mood: emotion,
        keywords: ["释怀", "平静", "接纳"]
      };
    
      try {
        let conversationText = "";
        history.forEach(h => {
          conversationText += `${h.role}: ${h.text}\n`;
        });
    
        const prompt = `
          请作为一位心理医生，总结我们刚才关于"${emotion}"的对话。
          生成一个JSON对象，用于写在一张旧纸上放入漂流瓶：
          
          1. "summary": 一句极具哲理和治愈感的话，能让人瞬间释怀。不要太长（25字以内）。
          2. "mood": 确认用户当前的深层情绪状态（2个字）。
          3. "keywords": 提取3个关于这次心灵疗愈的关键词。
    
          对话内容：
          ${conversationText}
        `;
    
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: { text: prompt },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                mood: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        });
    
        const text = response.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            summary: parsed.summary || fallbackData.summary,
            mood: parsed.mood || fallbackData.mood,
            keywords: Array.isArray(parsed.keywords) ? parsed.keywords : fallbackData.keywords
          };
        }
        return fallbackData;
    
      } catch (error) {
        console.error("Gemini Therapy Summary Error:", error);
        return fallbackData;
      }
}

// --- Standard Postcard Service ---
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