import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const OLD_INSECURE_DEFAULT = 'solvent_dev_insecure_default';

const envSchema = z.object({
  PORT: z.string()
    .transform(Number)
    .pipe(z.number().min(1).max(65535))
    .default('3001'),
  GEMINI_API_KEY: z.string().optional(),
  DEFAULT_PROVIDER: z.string().default('groq'),
  SERPER_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  DASHSCOPE_API_KEY: z.string().optional(),
  CEREBRAS_API_KEY: z.string().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(),
  FAL_API_KEY: z.string().optional(),
  OLLAMA_HOST: z.string().url().default('http://127.0.0.1:11434'),
  ENABLE_OLLAMA: z.string().transform(v => v === 'true').default('true'),
  BACKEND_INTERNAL_SECRET: z.string().min(32, 'BACKEND_INTERNAL_SECRET must be at least 32 characters for security'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  AI_PROVIDER_TIMEOUT_MS: z.string()
    .transform(Number)
    .pipe(z.number().min(1000).max(300000))
    .default('120000'),
  MEMORY_CACHE_SIZE: z.string()
    .transform(Number)
    .pipe(z.number().min(10).max(10000))
    .default('1000'),
  MEMORY_MAX_ENTRIES: z.string()
    .transform(Number)
    .pipe(z.number().min(10).max(50000))
    .default('1500'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const config = parsedEnv.data;

// Security validation: Ensure the secret is not the old insecure default
if (config.BACKEND_INTERNAL_SECRET === OLD_INSECURE_DEFAULT) {
  console.error('❌ SECURITY ERROR: BACKEND_INTERNAL_SECRET is set to the insecure default value.');
  console.error('   You MUST set a strong, unique secret in your .env file.');
  console.error('   Example: BACKEND_INTERNAL_SECRET=$(openssl rand -hex 32)');
  console.error('   Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// Validate secret strength (length check — Zod enforces min(32) and exits, so this is belt-and-suspenders)
if (config.BACKEND_INTERNAL_SECRET.length < 32) {
  console.warn('⚠️  WARNING: BACKEND_INTERNAL_SECRET is shorter than 32 characters and may be weak.');
  console.warn('   Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

export const APP_CONSTANTS = {
  WATERFALL: {
    MAX_RETRIES: 2,
    SCORE_THRESHOLD: 80,
    MAX_STEPS: 10
  },
  MODELS: {
    VISION_DEFAULT: 'gemini-1.5-flash',
    CODING_DEFAULT: 'llama-3.3-70b-versatile'
  }
};

