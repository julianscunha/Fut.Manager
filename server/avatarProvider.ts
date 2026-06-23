import { GoogleGenAI } from '@google/genai';

export interface AvatarProvider {
  generateAvatar(params: {
    photoOriginal: string;
    club: string;
    playerName: string;
  }): Promise<string>;
}

export class GeminiAvatarProvider implements AvatarProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateAvatar(params: {
    photoOriginal: string;
    club: string;
    playerName: string;
  }): Promise<string> {
    const ai = new GoogleGenAI({
      apiKey: this.apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    let base64Data = params.photoOriginal;
    let mimeType = 'image/png';

    const match = params.photoOriginal.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    } else if (params.photoOriginal.startsWith('http')) {
      const fetchRes = await globalThis.fetch(params.photoOriginal);
      const arrayBuffer = await fetchRes.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString('base64');
      const contentType = fetchRes.headers.get('content-type');
      if (contentType) mimeType = contentType;
    }

    const prompt = `Transform this photo into a professional soccer player portrait. 
Keep the original face, hair, mustache, beard, facial features, facial structure, skin tone, and expression exactly. 
Change ONLY the body clothing/uniform to a high-quality athletic jersey of the soccer club '${params.club}'. 
The background should be a professional sports stadium with athletic field grass, floodlights, slightly out of focus, matching the color identity of the club ${params.club}. 
The framing should be chest-up, athletic soccer player pose, professional sports portrait lighting.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          {
            text: prompt
          }
        ]
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error('Nenhuma imagem retornada no response do Gemini.');
  }
}

export class OpenAIAvatarProvider implements AvatarProvider {
  async generateAvatar(params: {
    photoOriginal: string;
    club: string;
    playerName: string;
  }): Promise<string> {
    throw new Error('OpenAI Provider não está implementado.');
  }
}

export class AvatarProviderFactory {
  static getProvider(): AvatarProvider {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      return new GeminiAvatarProvider(apiKey);
    }
    throw new Error('Nenhum provedor de avatar de IA disponível ou configurado.');
  }
}
