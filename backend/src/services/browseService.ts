import axios from 'axios';
import * as cheerio from 'cheerio';
import { PageContent } from '../types/ai';
import { AIProviderFactory } from './aiProviderFactory';
import { config } from '../config';

const MAX_CONTENT_LENGTH = 50_000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^localhost$/i,
];

function isPrivateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return PRIVATE_IP_PATTERNS.some(p => p.test(parsed.hostname));
  } catch {
    return true;
  }
}

const STRIP_SELECTORS = [
  'script', 'style', 'noscript', 'iframe', 'nav', 'footer',
  'header', '.advertisement', '.ad', '[role="banner"]',
  '[role="navigation"]', '[role="complementary"]', '.sidebar',
  '.cookie-banner', '.popup', '.modal',
];

class BrowseService {
  async fetchPage(url: string): Promise<PageContent> {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('Only http and https URLs are supported');
    }
    if (isPrivateUrl(url)) {
      throw new Error('Cannot browse private/local addresses');
    }

    const response = await axios.get(url, {
      timeout: FETCH_TIMEOUT_MS,
      maxContentLength: MAX_RESPONSE_SIZE,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SolventBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      responseType: 'text',
    });

    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const $ = cheerio.load(response.data);

    // Strip unwanted elements
    STRIP_SELECTORS.forEach(sel => $(sel).remove());

    // Extract metadata
    const title = $('meta[property="og:title"]').attr('content')
      || $('title').text().trim()
      || '';
    const siteName = $('meta[property="og:site_name"]').attr('content') || '';
    const author = $('meta[name="author"]').attr('content')
      || $('meta[property="article:author"]').attr('content')
      || '';
    const publishedDate = $('meta[property="article:published_time"]').attr('content')
      || $('time[datetime]').first().attr('datetime')
      || '';
    const excerpt = $('meta[property="og:description"]').attr('content')
      || $('meta[name="description"]').attr('content')
      || '';

    // Extract main content — prefer article/main, fallback to body
    let contentEl = $('article').first();
    if (!contentEl.length) contentEl = $('main').first();
    if (!contentEl.length) contentEl = $('[role="main"]').first();
    if (!contentEl.length) contentEl = $('body');

    const textContent = contentEl.text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_CONTENT_LENGTH);

    if (!textContent) {
      throw new Error('Could not extract readable content from page');
    }

    return {
      title,
      content: textContent,
      excerpt: excerpt || textContent.slice(0, 200),
      siteName,
      author,
      publishedDate,
      url,
    };
  }

  async summarizePage(content: string, instruction?: string): Promise<string> {
    const provider = await AIProviderFactory.getProvider(config.DEFAULT_PROVIDER || 'groq');

    const systemPrompt = instruction
      ? `You are a concise web page summarizer. The user wants a focused summary. Instruction: "${instruction}". Provide a clear, well-structured summary. Use bullet points for key takeaways.`
      : 'You are a concise web page summarizer. Provide a clear, well-structured summary of the following web page content. Highlight key points and takeaways using bullet points. Keep it under 500 words.';

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `Summarize this page content:\n\n${content.slice(0, 30_000)}` },
    ];

    const result = await provider.complete(messages, {
      model: provider.defaultModel || 'llama-3.3-70b-versatile',
      temperature: 0.3,
      maxTokens: 1024,
    });

    return result;
  }
}

export const browseService = new BrowseService();
