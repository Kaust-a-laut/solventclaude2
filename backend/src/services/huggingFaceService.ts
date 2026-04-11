import axios from 'axios';
import { logger } from '../utils/logger';
import { pollinationsService } from './pollinationsService';

export class HuggingFaceService {
  private readonly baseUrl = 'https://api-inference.huggingface.co/models/';
  // A very stable model that is almost always available on the free API
  private readonly defaultModel = 'prompthero/openjourney';

  /**
   * Generates an image using Hugging Face Inference API.
   * @param prompt The prompt to generate the image from.
   * @param apiKey Your Hugging Face API Token.
   * @param model Optional model override.
   */
  async generateImage(prompt: string, apiKey: string, model: string = this.defaultModel): Promise<{ base64: string, mimeType: string }> {
    try {
      const cleanKey = apiKey?.trim();
      const targetModel = model || this.defaultModel;
      const url = `${this.baseUrl}${targetModel}`;
      logger.info(`[HuggingFace] Requesting image: ${url}`);
      
      const response = await axios.post(
        url,
        { inputs: prompt },
        {
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 90000 
        }
      );

      logger.info(`[HuggingFace] Response received. Status: ${response.status}`);

      if (response.status !== 200) {
        throw new Error(`Hugging Face API returned status: ${response.status}`);
      }

      // Handle JSON error hidden in 200 status
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const json = JSON.parse(Buffer.from(response.data).toString());
        if (json.error) throw new Error(`HF API Error: ${json.error}`);
      }

      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      return { base64, mimeType: contentType.includes('image') ? contentType : 'image/png' };

    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[HuggingFace] Primary generation failed: ${err.message}. Initiating internal fallback.`);

      // Internal Fallback to Pollinations to ensure UI consistency
      try {
        const result = await pollinationsService.generateImage(prompt);
        return result;
      } catch (pollError: unknown) {
        const pollErr = pollError as Error;
        throw new Error(`Hugging Face failed (${err.message}) and fallback also failed.`);
      }
    }
  }
}

export const huggingFaceService = new HuggingFaceService();
