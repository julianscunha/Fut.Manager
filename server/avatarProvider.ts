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

export class OpenRouterAvatarProvider implements AvatarProvider {
  private apiKey: string;
  private model: string;
  private ignoreProviders: string[];

  constructor(apiKey: string, model: string, ignoreProviders: string[] = []) {
    this.apiKey = apiKey;
    this.model = model;
    this.ignoreProviders = ignoreProviders;
  }

  async generateAvatar(params: {
    photoOriginal: string;
    club: string;
    playerName: string;
  }): Promise<string> {
    let imageUrl = params.photoOriginal;

    // input_references aceita data URL ou URL http(s) — normaliza para data URL quando o dado já
    // vier em base64 puro (sem o prefixo data:mime;base64,).
    if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
      imageUrl = `data:image/png;base64,${imageUrl}`;
    }

    const prompt = `Transform this photo into a professional soccer player portrait.
Keep the original face, hair, mustache, beard, facial features, facial structure, skin tone, and expression exactly.
Change ONLY the body clothing/uniform to a high-quality athletic jersey of the soccer club '${params.club}'.
The background should be a professional sports stadium with athletic field grass, floodlights, slightly out of focus, matching the color identity of the club ${params.club}.
The framing should be chest-up, athletic soccer player pose, professional sports portrait lighting.`;

    const response = await globalThis.fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'Racha do Fofim'
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        input_references: [
          { type: 'image_url', image_url: { url: imageUrl } }
        ],
        ...(this.ignoreProviders.length > 0 ? { provider: { ignore: this.ignoreProviders } } : {})
      })
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`OpenRouter retornou ${response.status}: ${errorBody}`);
    }

    const json: any = await response.json();
    const image = json?.data?.[0];
    if (!image?.b64_json) {
      throw new Error(`Nenhuma imagem retornada no response do OpenRouter: ${JSON.stringify(json)}`);
    }

    const mediaType = image.media_type || 'image/png';
    return `data:${mediaType};base64,${image.b64_json}`;
  }
}

export class AvatarProviderFactory {
  static getProvider(): AvatarProvider {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
      const model = process.env.OPENROUTER_MODEL || 'openai/gpt-image-1';
      const ignoreProviders = (process.env.OPENROUTER_IGNORE_PROVIDERS || '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);
      return new OpenRouterAvatarProvider(openRouterKey, model, ignoreProviders);
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      return new GeminiAvatarProvider(geminiKey);
    }

    throw new Error('Nenhum provedor de avatar de IA disponível ou configurado. Defina OPENROUTER_API_KEY ou GEMINI_API_KEY.');
  }
}
