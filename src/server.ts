import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { TastyCoffeeClient } from "./tastycoffee-client.js";

const client = new TastyCoffeeClient();

const CartItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
  optionValueIds: z.array(z.number().int().positive()).default([]),
  forGift: z.string().nullable().optional(),
});

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "tastycoffee-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "search_products",
    {
      title: "Search products",
      description: "Search Tasty Coffee products by text query.",
      inputSchema: {
        query: z.string().min(1),
        limit: z.number().int().positive().max(50).default(12),
        page: z.number().int().positive().default(1),
      },
    },
    async ({ query, limit, page }) => jsonResult(await client.searchProducts(query, limit, page)),
  );

  server.registerTool(
    "list_catalog",
    {
      title: "List catalog",
      description: "List Tasty Coffee catalog products with optional filters.",
      inputSchema: {
        category: z.string().default("coffee"),
        q: z.string().optional(),
        methods: z.string().optional(),
        categories: z.string().optional(),
        filters: z.string().optional(),
        type: z.number().int().optional(),
        sort: z.string().optional(),
        order: z.string().optional(),
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().max(50).default(12),
        first: z.number().int().positive().optional(),
      },
    },
    async (args) => jsonResult(await client.listCatalog(args)),
  );

  server.registerTool(
    "get_product",
    {
      title: "Get product",
      description: "Fetch one product by category and slug.",
      inputSchema: {
        slug: z.string().min(1).describe("Product slug, for example black-candy."),
        category: z.string().default("coffee"),
      },
    },
    async ({ slug, category }) => jsonResult(await client.getProduct(slug, category)),
  );

  server.registerTool(
    "get_product_prices",
    {
      title: "Get product prices",
      description: "Fetch current prices and option prices for product ids.",
      inputSchema: {
        productIds: z.array(z.number().int().positive()).min(1).max(50),
        coupon: z.string().optional(),
      },
    },
    async ({ productIds, coupon }) => jsonResult(await client.getProductPrices(productIds, coupon)),
  );

  server.registerTool(
    "get_product_reviews",
    {
      title: "Get product reviews",
      description: "Fetch product reviews.",
      inputSchema: {
        productId: z.number().int().positive(),
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().max(30).default(5),
      },
    },
    async ({ productId, page, limit }) => jsonResult(await client.getProductReviews(productId, page, limit)),
  );

  server.registerTool(
    "get_catalog_filters",
    {
      title: "Get catalog filters",
      description: "Fetch filter groups for a catalog category.",
      inputSchema: {
        category: z.string().default("coffee"),
        method: z.string().optional(),
      },
    },
    async ({ category, method }) => jsonResult(await client.getCatalogFilters(category, method)),
  );

  server.registerTool(
    "get_home_blocks",
    {
      title: "Get home blocks",
      description: "Fetch Tasty Coffee home page product blocks.",
      inputSchema: {},
    },
    async () => jsonResult(await client.getHomeBlocks()),
  );

  server.registerTool(
    "get_city_delivery_summary",
    {
      title: "Get city delivery summary",
      description: "Fetch current city, popular cities, and delivery service summary.",
      inputSchema: {
        cityId: z.string().optional(),
      },
    },
    async ({ cityId }) => jsonResult(await client.getCityDeliverySummary(cityId)),
  );

  server.registerTool(
    "create_cart",
    {
      title: "Create cart quote",
      description: "Create an anonymous cart quote from items without checking out.",
      inputSchema: {
        items: z.array(CartItemSchema).min(1),
        couponCode: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
      },
    },
    async ({ items, couponCode }) => jsonResult(await client.createCart(items, couponCode)),
  );

  server.registerTool(
    "create_cart_share_link",
    {
      title: "Create cart share link",
      description: "Create an anonymous shared basket URL without checking out.",
      inputSchema: {
        items: z.array(CartItemSchema).min(1),
        couponCode: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
      },
    },
    async ({ items, couponCode }) => jsonResult(await client.createCartShareLink(items, couponCode)),
  );

  server.registerTool(
    "recommend_cart",
    {
      title: "Recommend cart",
      description: "Recommend high-rated 250g espresso coffees for milk drinks and black coffee, then create an anonymous shared basket URL.",
      inputSchema: {
        minRating: z.number().min(0).max(5).default(4.9),
        milkCount: z.number().int().min(0).max(10).default(3),
        blackCount: z.number().int().min(0).max(10).default(3),
        weight: z.string().default("250 г"),
        couponCode: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
      },
    },
    async (args) => jsonResult(await client.recommendCart(args)),
  );

  server.registerResource(
    "settings",
    "tastycoffee://settings",
    {
      title: "Tasty Coffee settings",
      description: "Public Tasty Coffee shop settings.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await client.getSettings(), null, 2),
        },
      ],
    }),
  );

  return server;
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await createServer().connect(transport);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
