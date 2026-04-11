import axios from 'axios';
import { logger } from '../utils/logger';

export class PollinationsService {
  private readonly baseUrl = 'https://image.pollinations.ai/prompt';

  /**
   * Generates an image using Pollinations.ai.
   * Returns a base64 string of the image.
   * @param prompt The prompt to generate the image from.
   * @param model Optional model specifier (though Pollinations auto-selects or uses query params, we'll append to prompt if needed or pass as query param).
   */
  async generateImage(prompt: string, model?: string): Promise<{ base64: string, mimeType: string }> {
    try {
      logger.info(`[Pollinations] Generating image for prompt: "${prompt}"`);
      
      const encodedPrompt = encodeURIComponent(prompt);
      // We can add parameters like width, height, model via query params if needed.
      // E.g. ?model=flux, ?width=1024, ?height=1024, ?nologo=true
      // Let's default to standard reliable settings.
      const url = `${this.baseUrl}/${encodedPrompt}?nologo=true`; 

      const response = await axios.get(url, {
        responseType: 'arraybuffer'
      });

      if (response.status !== 200) {
        throw new Error(`Pollinations API returned status: ${response.status}`);
      }

      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      
      // Determine mime type from headers or default to image/jpeg (Pollinations usually returns JPEG)
      const contentType = response.headers['content-type'] || 'image/jpeg';

      return {
        base64,
        mimeType: contentType
      };

    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[Pollinations] Error generating image: ${err.message}`);
      throw error;
    }
  }
}

export const pollinationsService = new PollinationsService();