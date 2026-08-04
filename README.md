# mcp-bright-data

Bright Data MCP — Bright Data Web Unlocker + SERP API (brightdata.com)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `brightdata_unlock` | Fetch any URL through Bright Data Web Unlocker — rotating residential proxies with automatic anti-bot bypass and CAPTCHA solving, built for the hardest-to-scrape sites (Cloudflare, PerimeterX, Akamai fronted). Returns the page content with status and length; large pages are truncated. Calls proxy the fetch synchronously and can take 10-30 seconds. BYOK: Bright Data API token via _apiKey + a Web Unlocker zone configured in your dashboard (first zone is auto-named "web_unlocker1"); pay-per-request pricing on the Bright Data side. Example: brightdata_unlock({ url: "https://example.com", _apiKey: "your-brightdata-token" }) |
| `brightdata_serp` | Run a Google search through the Bright Data SERP API and return parsed organic results (rank, title, link, description) with geo-targeting. Uses the same Bright Data request API with a SERP-type zone — create a SERP API zone in your Bright Data dashboard and pass its name as `zone` (Web Unlocker zones return raw HTML for Google). BYOK: Bright Data API token via _apiKey; pay-per-request pricing on the Bright Data side. Example: brightdata_serp({ query: "best espresso machine", zone: "serp_api1", country: "us", _apiKey: "your-brightdata-token" }) |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "bright-data": {
      "url": "https://gateway.pipeworx.io/bright-data/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Bright Data data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
