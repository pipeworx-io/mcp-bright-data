interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Bright Data MCP — Bright Data Web Unlocker + SERP API (brightdata.com)
 *
 * Bright Data exposes a SINGLE direct-API endpoint for both products:
 * POST https://api.brightdata.com/request with a JSON body
 * { zone, url, format, ... } and Bearer auth. Which product handles the
 * request is decided by the ZONE — a per-product configuration the user
 * creates in their Bright Data control panel (a Web Unlocker zone for
 * unlocking, a SERP API zone for search). The control panel auto-names the
 * first Web Unlocker zone "web_unlocker1".
 *
 * Tools:
 * - brightdata_unlock: fetch any URL through Web Unlocker (proxy rotation +
 *                      anti-bot bypass, CAPTCHA solving) → raw HTML / JSON envelope
 * - brightdata_serp:   Google search through a SERP API zone → parsed organic
 *                      results via the brd_json=1 URL parameter
 *
 * Out of scope: Bright Data's other products (Datasets/Marketplace, Scraping
 * Browser, Web Scraper IDE, proxy networks) — this pack covers the two
 * request-API products only.
 *
 * BYO-key via _apiKey = the Bright Data API token from the account settings /
 * zone Overview tab. Requires a Bright Data account with a configured zone;
 * usage is pay-per-request on the Bright Data side (they offer trial credit).
 *
 * Unlocker calls proxy the fetch synchronously and can take 10-30s on hard
 * targets; every request uses a 25s AbortController timeout.
 *
 * WEB-VERIFIED against https://docs.brightdata.com (2026-07):
 * - /request body params (zone, url, format raw|json, method, country,
 *   data_format, render) from api-reference/rest-api/unlocker/unlock-website
 * - "web_unlocker1" example zone name from the same page
 * - SERP: same /request endpoint, SERP-type zone, brd_json=1 for parsed JSON,
 *   gl/hl geo params, start pagination (num deprecated Sept 2025)
 * - Endpoint probed live: bogus token → HTTP 401, plain-text body "Invalid token"
 */


const ENDPOINT = 'https://api.brightdata.com/request';
const DASHBOARD_URL = 'https://brightdata.com/cp/zones';
const DOCS_URL = 'https://docs.brightdata.com/scraping-automation/web-unlocker/introduction';

const KEY_HINT =
  `Pass your Bright Data API token via _apiKey (from account settings or the zone Overview tab at ${DASHBOARD_URL}). You also need a configured zone — Bright Data sets up one zone per product; pricing is pay-per-successful-request on their side, with trial credit for new accounts. Docs: ${DOCS_URL}`;

const ZONE_HINT =
  `Create the matching zone in your Bright Data control panel (${DASHBOARD_URL}) and pass its exact name as \`zone\` — a Web Unlocker zone (auto-named "web_unlocker1") for brightdata_unlock, a SERP API zone for brightdata_serp.`;

// Cap raw page content returned downstream — pages can be megabytes.
const MAX_CONTENT_CHARS = 20000;
// Unlocker calls proxy the fetch synchronously (10-30s is normal on hard targets).
const TIMEOUT_MS = 25000;

const DEFAULT_UNLOCKER_ZONE = 'web_unlocker1';
const DEFAULT_SERP_ZONE = 'serp_api1';

const tools: McpToolExport['tools'] = [
  {
    name: 'brightdata_unlock',
    description:
      'Fetch any URL through Bright Data Web Unlocker — rotating residential proxies with automatic anti-bot bypass and CAPTCHA solving, built for the hardest-to-scrape sites (Cloudflare, PerimeterX, Akamai fronted). Returns the page content with status and length; large pages are truncated. Calls proxy the fetch synchronously and can take 10-30 seconds. BYOK: Bright Data API token via _apiKey + a Web Unlocker zone configured in your dashboard (first zone is auto-named "web_unlocker1"); pay-per-request pricing on the Bright Data side. Example: brightdata_unlock({ url: "https://example.com", _apiKey: "your-brightdata-token" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The absolute URL to fetch, including scheme, e.g. "https://example.com/page"',
        },
        zone: {
          type: 'string',
          description:
            `Your Web Unlocker zone name from the Bright Data control panel. Default "${DEFAULT_UNLOCKER_ZONE}" — the auto-generated name of the first Web Unlocker zone.`,
        },
        country: {
          type: 'string',
          description:
            'Two-letter ISO country code for the proxy exit location, e.g. "us", "gb", "de". Default: Bright Data auto-selects per your zone configuration.',
        },
        format: {
          type: 'string',
          description:
            'Response shape: "raw" (default — the target page body as a string) or "json" (a JSON envelope with status/headers/body metadata from Bright Data).',
        },
        _apiKey: {
          type: 'string',
          description:
            'Your Bright Data API token (account settings or zone Overview tab). Requires a Bright Data account with a Web Unlocker zone; sign up at https://brightdata.com',
        },
      },
      required: ['url', '_apiKey'],
    },
  },
  {
    name: 'brightdata_serp',
    description:
      'Run a Google search through the Bright Data SERP API and return parsed organic results (rank, title, link, description) with geo-targeting. Uses the same Bright Data request API with a SERP-type zone — create a SERP API zone in your Bright Data dashboard and pass its name as `zone` (Web Unlocker zones return raw HTML for Google). BYOK: Bright Data API token via _apiKey; pay-per-request pricing on the Bright Data side. Example: brightdata_serp({ query: "best espresso machine", zone: "serp_api1", country: "us", _apiKey: "your-brightdata-token" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The Google search query, e.g. "best espresso machine 2026"',
        },
        zone: {
          type: 'string',
          description:
            `Your SERP API zone name from the Bright Data control panel (a SERP-type zone is required for parsed Google results). Default "${DEFAULT_SERP_ZONE}" — the typical auto-generated name; check your dashboard for the exact name.`,
        },
        country: {
          type: 'string',
          description:
            'Two-letter country code for localized results (sent as Google\'s `gl` parameter), e.g. "us", "gb", "jp". Optional.',
        },
        num: {
          type: 'number',
          description:
            'Maximum organic results to return (client-side cap; Google serves ~10 per page — use `start` for deeper pages). Default 10.',
        },
        start: {
          type: 'number',
          description: 'Pagination offset: 0 = first page (default), 10 = second page, 20 = third.',
        },
        _apiKey: {
          type: 'string',
          description:
            'Your Bright Data API token (account settings or zone Overview tab). Requires a Bright Data account with a SERP API zone; sign up at https://brightdata.com',
        },
      },
      required: ['query', '_apiKey'],
    },
  },
];

// ---------------------------------------------------------------------------

function brightdataError(status: number, tool: string, detail?: string): Error {
  const tail = detail ? ` — ${detail}` : '';
  if (status === 401 || status === 403) {
    return new Error(
      `Bright Data ${tool}: auth failed (HTTP ${status}). Check that _apiKey is your Bright Data API token — copy it from account settings or the zone's Overview tab. ${KEY_HINT}${tail}`,
    );
  }
  if (status === 400 || status === 404 || status === 422) {
    return new Error(
      `Bright Data ${tool}: request rejected (HTTP ${status})${tail}. Most common cause: the \`zone\` value has a typo or the zone type mismatches the tool. ${ZONE_HINT}`,
    );
  }
  if (status === 429 || status === 402) {
    return new Error(
      `Bright Data ${tool}: account limit hit (HTTP ${status}) — rate limit, spend limit, or a suspended/unfunded zone. Review usage and billing in your Bright Data dashboard (${DASHBOARD_URL}).${tail}`,
    );
  }
  return new Error(`Bright Data ${tool} error: HTTP ${status}${tail}. Docs: ${DOCS_URL}`);
}

// Pull a message out of a non-2xx body, best-effort. Bright Data error bodies
// are often plain text ("Invalid token" — verified live), sometimes JSON.
async function readErrorDetail(res: Response): Promise<string | undefined> {
  try {
    const text = await res.text();
    if (!text) return undefined;
    try {
      const j = JSON.parse(text) as { error?: unknown; message?: unknown };
      const m = j.error ?? j.message;
      if (typeof m === 'string') return m;
      if (m != null) return JSON.stringify(m);
      return text.slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    // ignore
  }
  return undefined;
}

// POST to the single Bright Data request endpoint; returns the raw body text.
async function brightdataPost(
  body: Record<string, unknown>,
  apiKey: string,
  tool: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const e = err as Error;
    if (e.name === 'AbortError') {
      throw new Error(
        `Bright Data ${tool}: timed out after ${TIMEOUT_MS / 1000}s. Web Unlocker proxies the fetch synchronously and heavy anti-bot targets can exceed this window — retry, or try a simpler page first.`,
      );
    }
    throw new Error(`Bright Data ${tool}: network error reaching api.brightdata.com — ${e.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw brightdataError(res.status, tool, detail);
  }

  return res.text();
}

// Truncate raw page content so huge pages stay LLM-friendly.
function truncate(content: string): { content: string; content_length: number; truncated: boolean } {
  const truncated = content.length > MAX_CONTENT_CHARS;
  return {
    content: truncated ? content.slice(0, MAX_CONTENT_CHARS) : content,
    content_length: content.length,
    truncated,
  };
}

function pick<T = unknown>(obj: unknown, key: string): T | undefined {
  if (obj && typeof obj === 'object') {
    return (obj as Record<string, unknown>)[key] as T | undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------

async function unlock(args: Record<string, unknown>, apiKey: string) {
  const url = args.url as string | undefined;
  if (!url) {
    throw new Error('brightdata_unlock requires a `url` (absolute, e.g. "https://example.com").');
  }
  const zone =
    typeof args.zone === 'string' && args.zone.trim() ? args.zone.trim() : DEFAULT_UNLOCKER_ZONE;
  const format = args.format === 'json' ? 'json' : 'raw';

  const body: Record<string, unknown> = { zone, url, format };
  if (args.country) body.country = String(args.country).toLowerCase();

  const text = await brightdataPost(body, apiKey, 'brightdata_unlock');

  if (format === 'json') {
    // JSON envelope: Bright Data wraps the page with status/headers metadata.
    try {
      const envelope = JSON.parse(text) as Record<string, unknown>;
      const pageBody = pick<unknown>(envelope, 'body');
      const content = typeof pageBody === 'string' ? pageBody : text;
      return {
        url,
        zone,
        format,
        status_code: pick<number>(envelope, 'status_code') ?? null,
        ...truncate(content),
      };
    } catch {
      // Unexpected non-JSON body despite format=json — return it rather than throwing.
      return { url, zone, format, status_code: null, ...truncate(text) };
    }
  }

  // raw: the response body IS the target page content; a 2xx from the API
  // means the unlock succeeded.
  return { url, zone, format, status_code: 200, ...truncate(text) };
}

interface SerpOrganicEntry {
  rank?: number;
  global_rank?: number;
  link?: string;
  title?: string;
  description?: string;
}

async function serp(args: Record<string, unknown>, apiKey: string) {
  const query = args.query as string | undefined;
  if (!query) {
    throw new Error('brightdata_serp requires a `query`, e.g. "best espresso machine".');
  }
  const zone =
    typeof args.zone === 'string' && args.zone.trim() ? args.zone.trim() : DEFAULT_SERP_ZONE;
  const num = typeof args.num === 'number' && args.num > 0 ? Math.min(args.num, 100) : 10;

  // The search is expressed as a google.com/search URL; brd_json=1 makes the
  // SERP zone return parsed JSON instead of the raw HTML page.
  const params = new URLSearchParams({ q: query, brd_json: '1' });
  if (args.country) params.set('gl', String(args.country).toLowerCase());
  if (typeof args.start === 'number' && args.start > 0) params.set('start', String(args.start));
  const searchUrl = `https://www.google.com/search?${params.toString()}`;

  const text = await brightdataPost(
    { zone, url: searchUrl, format: 'raw' },
    apiKey,
    'brightdata_serp',
  );

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // The zone returned HTML instead of parsed JSON — usually a Web Unlocker
    // zone was passed, while parsed Google results need a SERP-type zone.
    return {
      query,
      zone,
      note:
        'Bright Data returned HTML instead of parsed JSON — this usually means the zone is a Web Unlocker zone, while parsed Google results need a SERP-type zone. Create a SERP API zone in your Bright Data dashboard and pass its name as `zone`. Returning the raw response, truncated.',
      ...truncate(text),
    };
  }

  const organicRaw = pick<SerpOrganicEntry[]>(parsed, 'organic') ?? [];
  const organic = (Array.isArray(organicRaw) ? organicRaw : []).slice(0, num).map((r) => ({
    rank: r.rank ?? r.global_rank ?? null,
    title: r.title ?? null,
    link: r.link ?? null,
    description: r.description ?? null,
  }));

  return {
    query,
    zone,
    country: args.country ? String(args.country).toLowerCase() : null,
    start: typeof args.start === 'number' ? args.start : 0,
    result_count: organic.length,
    organic,
    results_total: pick<number>(pick(parsed, 'general'), 'results_cnt') ?? null,
  };
}

// ---------------------------------------------------------------------------

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = args._apiKey as string;
  delete args._apiKey;

  if (!apiKey) {
    throw new Error(`Bright Data requires an API token via _apiKey. ${KEY_HINT}`);
  }

  switch (name) {
    case 'brightdata_unlock':
      return unlock(args, apiKey);
    case 'brightdata_serp':
      return serp(args, apiKey);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
