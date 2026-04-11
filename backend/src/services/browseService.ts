import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { PageContent } from '../types/ai';
import { AIProviderFactory } from './aiProviderFactory';
import { config } from '../config';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Strip images but preserve alt text as italic
turndown.addRule('images', {
  filter: 'img',
  replacement: (_content, node) => {
    const alt = (node as any).getAttribute?.('alt') || '';
    return alt ? `*[${alt}]*` : '';
  },
});

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
  // Paywall / access-gate overlays
  '.paywall', '.subscriber-only', '.piano-offer', '.pw-overlay',
  '.gate-overlay', '.metered-content', '[data-testid="paywall"]',
  '.ad-container', '.advert', '[id*="ad-"]', '.sponsor',
  '.subscription-prompt', '.regwall', '.registration-wall',
  // Interactive UI widgets (audio players, share bars, comment counts)
  '[data-testid="audio-player"]', '.audio-player', '.listen-bar',
  '.share-tools', '.share-bar', '.social-share', '[data-testid="share"]',
  '.comment-count', '.comments-link', '.comment-bar',
  'button', 'form', 'input', 'select', 'textarea',
];

// Patterns commonly injected by paywalled / ad-supported sites
const PAYWALL_TEXT_PATTERNS = [
  /you have a preview view of this article.*?will load\./gi,
  /thank you for your patience while we verify access\.?.*?$/gim,
  /if you are in reader mode.*?subscribe.*?$/gim,
  /SKIP ADVERTISEMENT\s*/g,
  /^Supported by\s*$/gm,
  /^Advertisement\s*$/gm,
  /Already a subscriber\? Log in\./gi,
  /Subscribe to continue reading\.?/gi,
  /Create a free account.*?continue reading\.?/gi,
  /This article is for subscribers only\.?/gi,
  /Sign up.*?to read this article\.?/gi,
  /To continue reading.*?please (subscribe|sign in|log in).*?$/gim,
  /Unlock this article.*?$/gim,
  /You('ve| have) reached your.*?free article(s)? limit\.?/gi,
  /Register for free.*?continue\.?/gi,
  // Interactive UI remnants (listen buttons, share prompts, comment counts)
  /^Listen\s*·\s*\d+:\d+\s*min\s*$/gm,
  /^Share full article\s*$/gm,
  /^Share\s*$/gm,
  /^\d+\s*$/gm,  // Orphaned numbers (comment counts, share counts)
  /^Read more.*?$/gm,
  /^Continue reading.*?$/gm,
  /^Copy link\s*$/gm,
  /^Save\s*$/gm,
  /^Bookmark\s*$/gm,
  /^Print\s*$/gm,
  /^Follow\s*$/gm,
  /^Gift this article\s*$/gm,
  /^Read in \w+\s*$/gm,
  /^Leer en español\s*$/gm,
];

class BrowseService {
  private async fetchHtml(targetUrl: string) {
    return axios.get(targetUrl, {
      timeout: FETCH_TIMEOUT_MS,
      maxContentLength: MAX_RESPONSE_SIZE,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      responseType: 'text',
      maxRedirects: 5,
    });
  }

  private async fetchWithFallback(url: string) {
    try {
      return await this.fetchHtml(url);
    } catch (error: any) {
      const status = error?.response?.status;

      // For auth/blocked errors, try Wayback Machine cache
      if (status === 401 || status === 403) {
        console.log(`[BrowseService] Got ${status} from ${url}, trying Wayback Machine...`);
        try {
          const waybackUrl = `https://web.archive.org/web/2024/${url}`;
          const waybackResponse = await this.fetchHtml(waybackUrl);
          console.log(`[BrowseService] Wayback fallback succeeded for ${url}`);
          return waybackResponse;
        } catch {
          // Wayback also failed — return restricted result
          console.log(`[BrowseService] Wayback fallback also failed for ${url}`);
          const hostname = new URL(url).hostname.replace(/^www\./, '');
          const restrictedError: any = new Error('restricted');
          restrictedError.restricted = true;
          restrictedError.restrictedResult = {
            title: `${hostname} — Login Required`,
            content: '',
            excerpt: `This page on ${hostname} requires authentication or blocks automated access. Open it directly in your browser to view.`,
            url,
            restricted: true,
          } as PageContent;
          throw restrictedError;
        }
      }

      if (status === 404) {
        throw new Error('Page not found (404)');
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('Page took too long to load');
      }
      throw new Error(`Failed to fetch page: ${error.message}`);
    }
  }

  async fetchPage(url: string): Promise<PageContent> {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('Only http and https URLs are supported');
    }
    if (isPrivateUrl(url)) {
      throw new Error('Cannot browse private/local addresses');
    }

    let response;
    try {
      response = await this.fetchWithFallback(url);
    } catch (error: any) {
      if (error.restricted) {
        return error.restrictedResult as PageContent;
      }
      throw error;
    }

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

    const rawHtml = contentEl.html() || '';
    let markdown = turndown.turndown(rawHtml);

    // Strip paywall / access-gate boilerplate text
    for (const pattern of PAYWALL_TEXT_PATTERNS) {
      markdown = markdown.replace(pattern, '');
    }

    markdown = markdown
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, MAX_CONTENT_LENGTH);

    if (!markdown) {
      throw new Error('Could not extract readable content from page');
    }

    return {
      title,
      content: markdown,
      excerpt: excerpt || markdown.replace(/[#*\[\]`>-]/g, '').slice(0, 200),
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

  async askAboutPage(content: string, question: string): Promise<string> {
    const provider = await AIProviderFactory.getProvider(config.DEFAULT_PROVIDER || 'groq');

    const messages = [
      {
        role: 'system' as const,
        content: 'You are a helpful assistant answering questions about web page content. Answer concisely and accurately based only on the provided content. If the content does not contain enough information to answer, say so.',
      },
      {
        role: 'user' as const,
        content: `Page content:\n\n${content.slice(0, 30_000)}\n\nQuestion: ${question}`,
      },
    ];

    const result = await provider.complete(messages, {
      model: provider.defaultModel || 'llama-3.3-70b-versatile',
      temperature: 0.3,
      maxTokens: 512,
    });

    return result;
  }
}

export const browseService = new BrowseService();
