import "server-only";

import { getEnv, loadRootEnv } from "@/lib/env";

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt?: string;
};

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value: string) {
  return decodeXml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function buildFinancialQuery(raw: string, context?: Record<string, unknown> | null) {
  const parts = [raw.trim()].filter(Boolean);
  if (context) {
    const upcomingEvents = Array.isArray(context.upcomingEvents)
      ? context.upcomingEvents
      : Array.isArray(context.events)
        ? context.events
        : [];
    const firstEvent =
      upcomingEvents.find((event) => event && typeof event === "object") as
        | Record<string, unknown>
        | undefined;
    const title = String(
      context.title || context.event_title || firstEvent?.title || ""
    ).trim();
    const currency = String(context.currency || firstEvent?.currency || "").trim();
    const country = String(
      context.country_code || context.country || firstEvent?.country_code || firstEvent?.country || ""
    ).trim();
    if (title) parts.push(title);
    if (currency) parts.push(`${currency} forex`);
    if (country) parts.push(country);
  }
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  return joined || "forex high impact economic calendar markets";
}

async function searchSerper(query: string, limit: number): Promise<SearchHit[]> {
  const key = getEnv("SERPER_API_KEY");
  if (!key) return [];
  const res = await fetch("https://google.serper.dev/news", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": key,
    },
    body: JSON.stringify({ q: query, num: limit }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}`);
  const data = (await res.json()) as {
    news?: Array<{ title?: string; link?: string; snippet?: string; source?: string; date?: string }>;
  };
  return (data.news || [])
    .filter((item) => item.title && item.link)
    .slice(0, limit)
    .map((item) => ({
      title: item.title || "",
      url: item.link || "",
      snippet: item.snippet || "",
      source: item.source || "serper",
      publishedAt: item.date,
    }));
}

async function searchTavily(query: string, limit: number): Promise<SearchHit[]> {
  const key = getEnv("TAVILY_API_KEY");
  if (!key) return [];
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "basic",
      include_answer: false,
      max_results: limit,
      topic: "news",
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (data.results || [])
    .filter((item) => item.title && item.url)
    .slice(0, limit)
    .map((item) => ({
      title: item.title || "",
      url: item.url || "",
      snippet: item.content || "",
      source: "tavily",
    }));
}

async function searchGoogleNewsRss(query: string, limit: number): Promise<SearchHit[]> {
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=en-US&gl=US&ceid=US:en";
  const res = await fetch(url, {
    headers: { "User-Agent": "forex-bot-cms/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Google News RSS ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit);
  return items.map((match) => {
    const block = match[1];
    const title = stripTags((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const link = stripTags((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "");
    const source = stripTags((block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || "google-news");
    const publishedAt = stripTags((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "");
    const snippet = stripTags((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || "");
    return { title, url: link, snippet, source, publishedAt };
  }).filter((hit) => hit.title && hit.url);
}

async function searchDuckDuckGo(query: string, limit: number): Promise<SearchHit[]> {
  const url =
    "https://api.duckduckgo.com/?q=" +
    encodeURIComponent(query) +
    "&format=json&no_redirect=1&no_html=1";
  const res = await fetch(url, {
    headers: { "User-Agent": "forex-bot-cms/1.0" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
  };
  const hits: SearchHit[] = [];
  if (data.Heading && data.AbstractURL) {
    hits.push({
      title: data.Heading,
      url: data.AbstractURL,
      snippet: data.AbstractText || "",
      source: "duckduckgo",
    });
  }
  for (const topic of data.RelatedTopics || []) {
    if (topic.Text && topic.FirstURL) {
      hits.push({
        title: topic.Text.slice(0, 120),
        url: topic.FirstURL,
        snippet: topic.Text,
        source: "duckduckgo",
      });
    }
    for (const nested of topic.Topics || []) {
      if (nested.Text && nested.FirstURL) {
        hits.push({
          title: nested.Text.slice(0, 120),
          url: nested.FirstURL,
          snippet: nested.Text,
          source: "duckduckgo",
        });
      }
    }
  }
  return hits.slice(0, limit);
}

export async function searchFinancialWeb({
  query,
  context,
  limit = 6,
}: {
  query?: string;
  context?: Record<string, unknown> | null;
  limit?: number;
}) {
  loadRootEnv();
  const q = buildFinancialQuery(query || "", context);
  const financialQuery = `${q} forex OR markets OR inflation OR central bank OR economic calendar`;

  const errors: string[] = [];
  let provider = "none";
  let hits: SearchHit[] = [];

  try {
    hits = await searchSerper(financialQuery, limit);
    if (hits.length) provider = "serper";
  } catch (error) {
    errors.push((error as Error).message);
  }

  if (!hits.length) {
    try {
      hits = await searchTavily(financialQuery, limit);
      if (hits.length) provider = "tavily";
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  if (!hits.length) {
    try {
      hits = await searchGoogleNewsRss(financialQuery, limit);
      if (hits.length) provider = "google-news-rss";
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  if (!hits.length) {
    try {
      hits = await searchDuckDuckGo(financialQuery, limit);
      if (hits.length) provider = "duckduckgo";
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  return {
    ok: hits.length > 0,
    query: financialQuery,
    provider,
    hits,
    errors,
  };
}

export function formatSearchBrief(hits: SearchHit[], query: string) {
  if (!hits.length) {
    return `No live web results for: ${query}`;
  }
  return [
    `Web research for: ${query}`,
    "",
    ...hits.map((hit, index) => {
      const when = hit.publishedAt ? ` (${hit.publishedAt})` : "";
      return `${index + 1}. ${hit.title}${when}\n   ${hit.snippet || "(no snippet)"}\n   Source: ${hit.source}\n   ${hit.url}`;
    }),
  ].join("\n");
}
