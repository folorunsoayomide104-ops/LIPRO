export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const DUCKDUCKGO_INSTANT_ANSWER = 'https://api.duckduckgo.com/';
const TAVILY_API = 'https://api.tavily.com/search';

export async function webSearch(query: string, limit: number = 5): Promise<SearchResult[]> {
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();
  if (tavilyKey) {
    try {
      const results = await tavilySearch(query, limit, tavilyKey);
      if (results.length > 0) return results;
    } catch {
      // fall through to DuckDuckGo
    }
  }
  return duckduckgoSearch(query, limit);
}

async function tavilySearch(query: string, limit: number, apiKey: string): Promise<SearchResult[]> {
  const res = await fetch(TAVILY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: limit, search_depth: 'advanced' }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || r.raw_content || '',
  }));
}

async function duckduckgoSearch(query: string, limit: number): Promise<SearchResult[]> {
  const url = `${DUCKDUCKGO_INSTANT_ANSWER}?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'LIPRO-AI/1.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const data = await res.json();

  const results: SearchResult[] = [];
  if (data.AbstractText) {
    results.push({ title: data.Heading || query, url: data.AbstractURL || '', snippet: data.AbstractText });
  }

  const collect = (node: any) => {
    if (results.length >= limit) return;
    if (Array.isArray(node.Topics)) {
      for (const t of node.Topics) collect(t);
      return;
    }
    if (node.Text && node.FirstURL) {
      results.push({ title: node.Text.split(' - ')[0] || query, url: node.FirstURL, snippet: node.Text });
    }
  };

  if (Array.isArray(data.RelatedTopics)) {
    for (const topic of data.RelatedTopics) {
      collect(topic);
      if (results.length >= limit) break;
    }
  }
  return results.slice(0, limit);
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return 'No results found for the search.';
  return results
    .map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\nSource: ${r.url}`)
    .join('\n\n');
}
