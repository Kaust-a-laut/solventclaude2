import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * FAL.ai image generation service.
 * Uses the FAL.ai REST API (fal-ai/flux/schnell) to generate images from text prompts.
 * Requires a FAL_API_KEY — get yours at https://fal.ai/
 */
export class FalService {
  private readonly apiUrl = 'https://fal.run/fal-ai/flux/schnell';

  /**
   * Generate an image using FAL.ai Flux Schnell.
   * @param prompt  Text description of the image to generate.
   * @param apiKey  FAL.ai API key.
   * @returns base64-encoded PNG image.
   */
  async generateImage(prompt: string, apiKey: string): Promise<{ base64: string; mimeType: string }> {
    logger.info(`[FAL] Generating image: "${prompt.slice(0, 80)}..."`);

    // Step 1: Submit request to FAL queue
    const submitRes = await axios.post(
      this.apiUrl,
      { prompt, num_inference_steps: 4, image_size: 'landscape_4_3' },
      {
        headers: {
          Authorization: `Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
      },
    );

    // FAL returns either a direct result or a queue request_id
    let imageUrl: string | null = null;

    if (submitRes.data?.images?.[0]?.url) {
      imageUrl = submitRes.data.images[0].url;
    } else if (submitRes.data?.request_id) {
      // Poll the queue result endpoint
      const requestId = submitRes.data.request_id;
      const resultUrl = `https://queue.fal.run/fal-ai/flux/schnell/requests/${requestId}`;

      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await axios.get(resultUrl, {
          headers: { Authorization: `Key ${apiKey}` },
          timeout: 10_000,
        });
        if (pollRes.data?.status === 'COMPLETED' && pollRes.data?.response?.images?.[0]?.url) {
          imageUrl = pollRes.data.response.images[0].url;
          break;
        }
        if (pollRes.data?.status === 'FAILED') {
          throw new Error(`FAL generation failed: ${pollRes.data?.error ?? 'unknown'}`);
        }
      }
    }

    if (!imageUrl) throw new Error('FAL.ai did not return an image URL');

    // Step 2: Fetch the image and convert to base64
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30_000 });
    const base64 = Buffer.from(imgRes.data, 'binary').toString('base64');
    const contentType: string = imgRes.headers['content-type'] ?? 'image/jpeg';

    logger.info('[FAL] Image generation complete');
    return { base64, mimeType: contentType };
  }
}

export const falService = new FalService();
