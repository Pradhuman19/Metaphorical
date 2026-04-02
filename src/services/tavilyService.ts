import axios from 'axios';

const TAVILY_API_URL = 'https://api.tavily.com/search';
const MAX_CONTENT_CHARS = 600;

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyRawResult {
  title: string;
  url: string;
  content?: string;
  score: number;
}

interface TavilySearchResponse {
  results: TavilyRawResult[];
}

export async function findAlternativePerspectives(
  apiKey: string,
  headline: string,
  originalUrl: string
): Promise<TavilySearchResult[]> {
  if (!apiKey) {
    throw new Error('Tavily API key not configured. Go to Settings to add your key.');
  }

  console.log(`[Tavily] Searching: "${headline.slice(0, 80)}…"`);

  const response = await axios.post<TavilySearchResponse>(TAVILY_API_URL, {
    api_key: apiKey,
    query: `${headline} news`,
    search_depth: 'basic',
    include_raw_content: false,
    include_answer: false,
    max_results: 5,
  });

  const results = response.data.results || [];
  const originalDomain = extractDomain(originalUrl);
  const seenDomains = new Set<string>([originalDomain]);
  const diverseResults: TavilySearchResult[] = [];

  for (const result of results) {
    const domain = extractDomain(result.url);
    if (!domain || seenDomains.has(domain)) continue;
    seenDomains.add(domain);

    const content = (result.content || '').trim();
    diverseResults.push({
      title: result.title,
      url: result.url,
      content: content.length > MAX_CONTENT_CHARS
        ? content.slice(0, MAX_CONTENT_CHARS) + '...'
        : content,
      score: result.score,
    });

    if (diverseResults.length >= 3) break;
  }

  console.log(`[Tavily] Found ${diverseResults.length} diverse sources.`);
  return diverseResults;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return ''; }
}
