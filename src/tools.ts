import { z } from "zod";

import {
  ACIDITY,
  BODY,
  COLLECTIONS,
  FEATURE,
  FLAVOR,
  ORIGIN,
  PROCESSING,
  resolveCollection,
  resolveFilterIds,
  ROAST,
  type FacetSelection,
} from "./filters.js";
import { TastyCoffeeClient } from "./tastycoffee-client.js";

/** Builds a zod enum from a facet record so the vocabulary lives in one place. */
function enumOf(record: Record<string, unknown>) {
  return z.enum(Object.keys(record) as [string, ...string[]]);
}

/**
 * Facet params shared by the catalog tools. They map the shop's sidebar filters
 * onto readable values; `resolveFilterIds` turns them into the numeric ids the
 * API wants. `filters` stays available as a raw escape hatch.
 */
const FacetShape = {
  acidity: enumOf(ACIDITY).optional().describe("Acidity (Кислотность)."),
  body: enumOf(BODY).optional().describe("Body (Плотность)."),
  roast: z.array(enumOf(ROAST)).optional().describe("Roast level (Степень обжарки)."),
  flavor: z.array(enumOf(FLAVOR)).optional().describe("Flavour profile (Вкус кофе)."),
  processing: z.array(enumOf(PROCESSING)).optional().describe("Processing method (Способ обработки)."),
  origin: z.array(enumOf(ORIGIN)).optional().describe("Country of origin (Страна произрастания)."),
  feature: z.array(enumOf(FEATURE)).optional().describe("Coffee feature (Особенность кофе)."),
};

const CollectionParam = enumOf(COLLECTIONS)
  .optional()
  .describe("Curated shop collection (подборка), e.g. новинки.");

type FacetArgs = FacetSelection & { collection?: string; filters?: string; type?: number };

/** Splits facet params off a tool's args and folds them into the raw catalog query. */
function applyFacets<T extends FacetArgs>(args: T) {
  const { acidity, body, roast, flavor, processing, origin, feature, collection, filters, type, ...rest } = args;
  const resolved = resolveFilterIds({ acidity, body, roast, flavor, processing, origin, feature }, filters);
  return {
    ...rest,
    ...(resolved ? { filters: resolved } : {}),
    ...(collection ? { type: resolveCollection(collection) } : type === undefined ? {} : { type }),
  };
}

const CartItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
  optionValueIds: z.array(z.number().int().positive()).default([]),
  forGift: z.string().nullable().optional(),
});

export type ToolAnnotations = {
  readOnlyHint?: boolean;
};

export type ToolSpec<S extends z.ZodRawShape = z.ZodRawShape> = {
  name: string;
  title: string;
  description: string;
  inputSchema: S;
  annotations?: ToolAnnotations;
  handler: (client: TastyCoffeeClient, args: z.infer<z.ZodObject<S>>) => Promise<unknown>;
};

function defineTool<S extends z.ZodRawShape>(spec: ToolSpec<S>): ToolSpec<S> {
  return spec;
}

/**
 * Single source of truth for the tool surface: `createServer` registers these
 * with the MCP SDK and the landing page renders the very same list, so what a
 * model sees and what a human reads can never drift apart.
 */
export const TOOL_SPECS: ToolSpec<any>[] = [
  defineTool({
    name: "search_products",
    title: "Search products",
    description: "Search Tasty Coffee products by text query.",
    inputSchema: {
      query: z.string().min(1),
      limit: z.number().int().positive().max(50).default(12),
      page: z.number().int().positive().default(1),
    },
    handler: (client, { query, limit, page }) => client.searchProducts(query, limit, page),
  }),
  defineTool({
    name: "list_catalog",
    title: "List catalog",
    description:
      "List Tasty Coffee catalog products, filtered by the shop's sidebar facets. "
      + "Values from one facet are OR-ed, different facets are AND-ed. "
      + "Use `collection` for the shop's own selections (новинки, популярное, сорт недели). "
      + "Sorting: sort=price|rating|rating_q with order=asc|desc; there is no sort by date.",
    inputSchema: {
      category: z.string().default("coffee"),
      q: z.string().optional(),
      methods: z.string().optional().describe("Brewing method: 1b espresso, 3b filter, 5a capsules, 6a drip bags."),
      categories: z.string().optional(),
      ...FacetShape,
      collection: CollectionParam,
      filters: z.string().optional().describe("Raw numeric filter ids, merged with the facet params above."),
      type: z.number().int().optional().describe("Raw collection id; prefer `collection`."),
      sort: z.string().optional().describe("price | rating | rating_q"),
      order: z.string().optional().describe("asc | desc"),
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(50).default(12),
      first: z.number().int().positive().optional(),
    },
    handler: (client, args) => client.listCatalog(applyFacets(args)),
  }),
  defineTool({
    name: "get_product",
    title: "Get product",
    description: "Fetch one product by category and slug.",
    inputSchema: {
      slug: z.string().min(1).describe("Product slug, for example black-candy."),
      category: z.string().default("coffee"),
    },
    handler: (client, { slug, category }) => client.getProduct(slug, category),
  }),
  defineTool({
    name: "get_product_prices",
    title: "Get product prices",
    description: "Fetch current prices and option prices for product ids.",
    inputSchema: {
      productIds: z.array(z.number().int().positive()).min(1).max(50),
      coupon: z.string().optional(),
    },
    handler: (client, { productIds, coupon }) => client.getProductPrices(productIds, coupon),
  }),
  defineTool({
    name: "get_product_reviews",
    title: "Get product reviews",
    description: "Fetch product reviews.",
    inputSchema: {
      productId: z.number().int().positive(),
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(30).default(5),
    },
    handler: (client, { productId, page, limit }) => client.getProductReviews(productId, page, limit),
  }),
  defineTool({
    name: "get_catalog_filters",
    title: "Get catalog filters",
    description: "Fetch filter groups for a catalog category.",
    inputSchema: {
      category: z.string().default("coffee"),
      method: z.string().optional(),
    },
    handler: (client, { category, method }) => client.getCatalogFilters(category, method),
  }),
  defineTool({
    name: "get_home_blocks",
    title: "Get home blocks",
    description: "Fetch Tasty Coffee home page product blocks.",
    inputSchema: {},
    handler: (client) => client.getHomeBlocks(),
  }),
  defineTool({
    name: "get_city_delivery_summary",
    title: "Get city delivery summary",
    description: "Fetch current city, popular cities, and delivery service summary.",
    inputSchema: {
      cityId: z.string().optional(),
    },
    handler: (client, { cityId }) => client.getCityDeliverySummary(cityId),
  }),
  defineTool({
    name: "list_discounts",
    title: "List discounted products",
    description:
      "Products currently sold below their regular price, best discount first. "
      + "The shop API has no discount facet, so this walks the catalog and compares "
      + "price against the pre-discount price; accepts the same facets as list_catalog.",
    inputSchema: {
      category: z.string().default("coffee"),
      methods: z.string().optional().describe("Brewing method: 1b espresso, 3b filter, 5a capsules, 6a drip bags."),
      ...FacetShape,
      collection: CollectionParam,
      filters: z.string().optional(),
      minDiscountPercent: z.number().min(1).max(100).default(1),
      limit: z.number().int().positive().max(50).default(20),
    },
    handler: (client, args) => {
      const { minDiscountPercent, limit, ...query } = args;
      return client.listDiscountedProducts(applyFacets(query), minDiscountPercent, limit);
    },
  }),
  defineTool({
    name: "create_cart",
    title: "Create cart quote",
    description: "Create an anonymous cart quote from items without checking out.",
    inputSchema: {
      items: z.array(CartItemSchema).min(1),
      couponCode: z.string().optional(),
    },
    annotations: { readOnlyHint: false },
    handler: (client, { items, couponCode }) => client.createCart(items, couponCode),
  }),
  defineTool({
    name: "create_cart_share_link",
    title: "Create cart share link",
    description: "Create an anonymous shared basket URL without checking out.",
    inputSchema: {
      items: z.array(CartItemSchema).min(1),
      couponCode: z.string().optional(),
    },
    annotations: { readOnlyHint: false },
    handler: (client, { items, couponCode }) => client.createCartShareLink(items, couponCode),
  }),
  defineTool({
    name: "recommend_cart",
    title: "Recommend cart",
    description:
      "Recommend high-rated 250g espresso coffees for milk drinks and black coffee, then create an anonymous shared basket URL.",
    inputSchema: {
      minRating: z.number().min(0).max(5).default(4.9),
      milkCount: z.number().int().min(0).max(10).default(3),
      blackCount: z.number().int().min(0).max(10).default(3),
      weight: z.string().default("250 г"),
      couponCode: z.string().optional(),
    },
    annotations: { readOnlyHint: false },
    handler: (client, args) => client.recommendCart(args),
  }),
];

export type ToolParameter = {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
};

type ZodInternal = {
  _def?: {
    typeName?: string;
    innerType?: unknown;
    type?: unknown;
    values?: unknown;
    defaultValue?: () => unknown;
    description?: string;
  };
  description?: string;
};

function typeLabel(schema: unknown): string {
  const def = (schema as ZodInternal)?._def;
  switch (def?.typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodArray": {
      const inner = typeLabel(def.type);
      return inner.includes(" | ") ? `(${inner})[]` : `${inner}[]`;
    }
    case "ZodObject":
      return "object";
    case "ZodEnum":
      return Array.isArray(def.values) ? def.values.join(" | ") : "enum";
    default:
      return "any";
  }
}

/** Flattens optional/default/nullable wrappers so the page can show a plain type. */
export function describeParameter(name: string, schema: unknown): ToolParameter {
  let current = schema as ZodInternal;
  let required = true;
  let defaultValue: string | undefined;
  const description = current?.description;

  for (;;) {
    const typeName = current?._def?.typeName;
    if (typeName === "ZodOptional" || typeName === "ZodNullable") {
      required = false;
      current = current._def!.innerType as ZodInternal;
    } else if (typeName === "ZodDefault") {
      required = false;
      const factory = current._def!.defaultValue;
      if (typeof factory === "function") {
        defaultValue = JSON.stringify(factory());
      }
      current = current._def!.innerType as ZodInternal;
    } else {
      break;
    }
  }

  return {
    name,
    type: typeLabel(current),
    required,
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...(description === undefined ? {} : { description }),
  };
}

export function describeToolParameters(spec: ToolSpec<any>): ToolParameter[] {
  return Object.entries(spec.inputSchema).map(([name, schema]) => describeParameter(name, schema));
}
