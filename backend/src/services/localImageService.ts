import axios from 'axios';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export class LocalImageService {
  private readonly defaultUrl = 'http://127.0.0.1:7860/sdapi/v1/txt2img';
  private readonly optionsUrl = 'http://127.0.0.1:7860/sdapi/v1/options';
  private readonly localModelFile = 'juggernautXL_ragnarokBy.safetensors';

  async checkModelAvailability(): Promise<{ loaded: boolean, model?: string, fileExists?: boolean }> {
    const rootPath = path.join(process.cwd(), '..');
    const fileExists = fs.existsSync(path.join(rootPath, this.localModelFile)) || fs.existsSync(path.join(process.cwd(), this.localModelFile));

    try {
      const response = await axios.get(this.optionsUrl, { timeout: 2000 });
      if (response.status === 200) {
        return { 
          loaded: true, 
          model: response.data.sd_model_checkpoint,
          fileExists
        };
      }
      return { loaded: false, fileExists };
    } catch (error) {
      return { loaded: false, fileExists };
    }
  }

  /**
   * Generates an image using a local Stable Diffusion API (A1111 style).
   * @param prompt The prompt to generate the image from.
   * @param options Optional overrides for the local generator.
   */
  async generateImage(prompt: string, options: Record<string, unknown> = {}): Promise<{ base64: string, mimeType: string }> {
    try {
      const url = (options.localUrl as string) || this.defaultUrl;
      const isXL = prompt.toLowerCase().includes('xl') || (options.model as string)?.toLowerCase().includes('xl') || (options.model as string)?.toLowerCase().includes('juggernaut');

      logger.info(`[LocalImage] Generating image at ${url} for prompt: "${prompt.substring(0, 50)}..."`);

      const payload: {
        prompt: string;
        negative_prompt: string;
        steps: number;
        cfg_scale: number;
        width: number;
        height: number;
        sampler_name: string;
        override_settings: Record<string, string>;
      } = {
        prompt: prompt,
        negative_prompt: (options.negativePrompt as string) || "easynegative, low quality, bad anatomy, blurry, watermark",
        steps: (options.steps as number) || 30,
        cfg_scale: (options.cfgScale as number) || 7.0,
        width: (options.width as number) || (isXL ? 1024 : 1024),
        height: (options.height as number) || (isXL ? 1024 : 1024),
        sampler_name: (options.sampler as string) || "DPM++ 2M Karras",
        override_settings: {}
      };

      // If user specifically wants Juggernaut or it's detected
      if (isXL) {
        payload.override_settings.sd_model_checkpoint = "juggernautXL_ragnarokBy";
      }

      const response = await axios.post(url, payload, {
        timeout: 120000 // 2 minutes timeout for local generation
      });

      if (response.status !== 200) {
        throw new Error(`Local SD API returned status: ${response.status}`);
      }

      // A1111 returns { images: [base64_string, ...] }
      if (!response.data.images || response.data.images.length === 0) {
        throw new Error('No images returned from local SD API');
      }

      const base64 = response.data.images[0];
      
      return {
        base64,
        mimeType: 'image/png'
      };

    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[LocalImage] Error generating image: ${err.message}`);
      throw error;
    }
  }
}

export const localImageService = new LocalImageService();
