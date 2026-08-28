# Tasty Coffee MCP

Read-only catalog MCP plus anonymous cart sharing for `shop.tastycoffee.ru`.

## Tools

- `search_products`
- `list_catalog`
- `get_product`
- `get_product_prices`
- `get_product_reviews`
- `list_discounts`
- `get_catalog_filters`
- `get_home_blocks`
- `get_city_delivery_summary`
- `create_cart`
- `create_cart_share_link`
- `recommend_cart`

## Catalog facets

`list_catalog` and `list_discounts` accept the shop's sidebar filters as readable
values instead of numeric ids: `acidity`, `body`, `roast`, `flavor`, `processing`,
`origin`, `feature`, plus `collection` for the shop's own selections (`новинки`,
`популярное`, `сорт недели`, …). Values within one facet are OR-ed, different
facets are AND-ed, which is what the API already does with a flat id list.

The mapping lives in `src/filters.ts` and is rendered on the landing page. The
ids are hardcoded so a model can discover them from the schema; to check them
against the live catalog:

```bash
TASTYCOFFEE_LIVE=1 npm test
```

`bought_before` is not exposed — it needs a logged-in account and this server is
anonymous. There is no discount facet in the API either, so `list_discounts`
walks the catalog and compares each price against its pre-discount price.

`recommend_cart` selects espresso-machine coffees by rating, separates milk-friendly and black-coffee picks, uses the requested pack size (`250 г` by default), and returns a shared basket URL.

## Development

```bash
npm install
npm test
npm run build
```

## Run

```bash
npm run build
node dist/src/server.js
```

HTTP transport:

```bash
npm run build
PORT=3000 npm run start:http
```

The remote MCP endpoint is:

```text
http://localhost:3000/mcp
```

## Deploy

Any Node.js hosting that supports long-lived HTTP requests can run the remote MCP server.

Build command:

```bash
npm install && npm run build
```

Start command:

```bash
npm run start:http
```

The server reads `PORT` from the environment and exposes:

```text
GET  /            landing page (HTML)
GET  /healthz     health check (JSON)
GET  /mcp         landing page (HTML), or the MCP stream for `Accept: text/event-stream`
POST /mcp         MCP requests
DELETE /mcp       MCP session teardown
```

## Landing page

`GET /mcp` from a browser serves a self-contained HTML page describing the server,
the connection snippets, and every tool with its parameters. A streamable-HTTP
client always sends `Accept: text/event-stream` on `GET`, so protocol traffic is
unaffected — only human visitors see the page.

The tool list is rendered from `src/tools.ts`, the same registry `createServer()`
registers against the MCP SDK, so the page cannot drift from what a model sees.
A test asserts the two stay identical.

In the deployed setup nginx answers `/` with a 302 to `/mcp` so there is a single
canonical URL, and the app's own `/` handler only matters in local development.

The page shows the URL the visitor arrived on, reading `X-Forwarded-Host` and
`X-Forwarded-Proto` when behind a reverse proxy. Set `PUBLIC_URL` to override:

```bash
PUBLIC_URL=https://tastycoffee.muxee4ka.ru npm run start:http
```

Docker:

```bash
docker build -t tastycoffee-mcp .
docker run --rm -p 3000:3000 tastycoffee-mcp
```

## OpenClaw

Local setup:

```bash
git clone https://github.com/Muxee4ka/tastycoffee-mcp.git
cd tastycoffee-mcp
npm install
npm run build
openclaw mcp add tastycoffee --command node --arg "$PWD/dist/src/server.js" --cwd "$PWD"
openclaw mcp probe tastycoffee
```

On Windows PowerShell:

```powershell
git clone https://github.com/Muxee4ka/tastycoffee-mcp.git
cd tastycoffee-mcp
npm install
npm run build
$serverPath = Join-Path (Get-Location) "dist\src\server.js"
openclaw mcp add tastycoffee --command node --arg "$serverPath" --cwd "$PWD"
openclaw mcp probe tastycoffee
```

This server uses MCP stdio transport, so each user runs their own local copy.

Remote HTTP setup after deployment:

```bash
openclaw mcp add tastycoffee --url "https://your-domain.example/mcp" --transport streamable-http
openclaw mcp probe tastycoffee
```
