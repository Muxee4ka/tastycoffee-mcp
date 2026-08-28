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
