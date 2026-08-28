# Tasty Coffee MCP

Read-only catalog MCP plus anonymous cart sharing for `shop.tastycoffee.ru`.

## Tools

- `search_products`
- `list_catalog`
- `get_product`
- `get_product_prices`
- `get_product_reviews`
- `get_catalog_filters`
- `get_home_blocks`
- `get_city_delivery_summary`
- `create_cart`
- `create_cart_share_link`
- `recommend_cart`

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
GET /healthz
POST /mcp
GET /mcp
DELETE /mcp
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
