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
  acidity: enumOf(ACIDITY).optional().describe("Кислотность."),
  body: enumOf(BODY).optional().describe("Плотность."),
  roast: z.array(enumOf(ROAST)).optional().describe("Степень обжарки."),
  flavor: z.array(enumOf(FLAVOR)).optional().describe("Вкус кофе."),
  processing: z.array(enumOf(PROCESSING)).optional().describe("Способ обработки."),
  origin: z.array(enumOf(ORIGIN)).optional().describe("Страна произрастания."),
  feature: z.array(enumOf(FEATURE)).optional().describe("Особенность кофе."),
};

const CollectionParam = enumOf(COLLECTIONS)
  .optional()
  .describe("Подборка магазина, например новинки.");

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
    title: "Поиск товаров",
    description:
      "Поиск товаров Tasty Coffee по текстовому запросу. Возвращает id, название, ссылку, "
      + "описание, цену, цену без скидки и процент скидки, рейтинг и число отзывов, способ "
      + "обработки, кислотность, насыщенность, фото, наличие и опции (помол, объём упаковки).",
    inputSchema: {
      query: z.string().min(1),
      limit: z.number().int().positive().max(50).default(12),
      page: z.number().int().positive().default(1),
    },
    handler: (client, { query, limit, page }) => client.searchProducts(query, limit, page),
  }),
  defineTool({
    name: "list_catalog",
    title: "Каталог с фильтрами",
    description:
      "Каталог Tasty Coffee с теми же фильтрами, что в сайдбаре на сайте: кислотность, "
      + "плотность, степень обжарки, вкус, способ обработки, страна произрастания, особенность. "
      + "Значения одного фильтра объединяются по «или», разные фильтры — по «и». "
      + "collection — готовые подборки магазина (новинки, популярное, сорт недели). "
      + "Сортировка: sort=price|rating|rating_q вместе с order=asc|desc; сортировки по дате нет. "
      + "Поля товара те же, что у search_products.",
    inputSchema: {
      category: z.string().default("coffee"),
      q: z.string().optional(),
      methods: z.string().optional().describe("Способ приготовления: 1b эспрессо, 3b фильтр, 5a капсулы, 6a дрип-пакеты."),
      categories: z.string().optional(),
      ...FacetShape,
      collection: CollectionParam,
      filters: z.string().optional().describe("Сырые числовые id фильтров, объединяются с именованными фильтрами выше."),
      type: z.number().int().optional().describe("Сырой id подборки; лучше использовать collection."),
      sort: z.string().optional().describe("price — цена, rating — рейтинг, rating_q — оценка Q-грейдера."),
      order: z.string().optional().describe("asc — по возрастанию, desc — по убыванию."),
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(50).default(12),
      first: z.number().int().positive().optional(),
    },
    handler: (client, args) => client.listCatalog(applyFacets(args)),
  }),
  defineTool({
    name: "get_product",
    title: "Карточка товара",
    description:
      "Детальная карточка одного товара по категории и слагу: описание, цена и скидка, "
      + "рейтинг, способ обработки, кислотность, насыщенность, фото и доступные опции "
      + "помола и объёма упаковки с их id — они нужны для сборки корзины.",
    inputSchema: {
      slug: z.string().min(1).describe("Слаг товара, например black-candy."),
      category: z.string().default("coffee"),
    },
    handler: (client, { slug, category }) => client.getProduct(slug, category),
  }),
  defineTool({
    name: "get_product_prices",
    title: "Цены товаров",
    description: "Актуальные цены и цены опций для списка id товаров. Можно передать промокод.",
    inputSchema: {
      productIds: z.array(z.number().int().positive()).min(1).max(50),
      coupon: z.string().optional(),
    },
    handler: (client, { productIds, coupon }) => client.getProductPrices(productIds, coupon),
  }),
  defineTool({
    name: "get_product_reviews",
    title: "Отзывы о товаре",
    description: "Отзывы о товаре: текст, оценка, дата и автор.",
    inputSchema: {
      productId: z.number().int().positive(),
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(30).default(5),
    },
    handler: (client, { productId, page, limit }) => client.getProductReviews(productId, page, limit),
  }),
  defineTool({
    name: "get_catalog_filters",
    title: "Фильтры каталога",
    description:
      "Группы фильтров каталога с актуальными id значений. Нужен, только если требуется "
      + "фильтр, которого нет среди именованных параметров list_catalog.",
    inputSchema: {
      category: z.string().default("coffee"),
      method: z.string().optional(),
    },
    handler: (client, { category, method }) => client.getCatalogFilters(category, method),
  }),
  defineTool({
    name: "get_home_blocks",
    title: "Блоки главной страницы",
    description:
      "Блоки главной страницы Tasty Coffee: новинки, популярное, наборы, сорт недели, "
      + "статистика, отзывы и обжарка.",
    inputSchema: {},
    handler: (client) => client.getHomeBlocks(),
  }),
  defineTool({
    name: "get_city_delivery_summary",
    title: "Город и доставка",
    description: "Текущий город, список популярных городов и сводка по службам доставки.",
    inputSchema: {
      cityId: z.string().optional(),
    },
    handler: (client, { cityId }) => client.getCityDeliverySummary(cityId),
  }),
  defineTool({
    name: "list_discounts",
    title: "Товары со скидкой",
    description:
      "Товары, которые сейчас продаются дешевле обычной цены, начиная с самой большой скидки. "
      + "В API магазина нет фильтра по акциям, поэтому тул обходит каталог и сравнивает цену "
      + "с ценой без скидки. Принимает те же фильтры, что list_catalog. "
      + "В meta возвращает, сколько товаров просмотрено и сколько подошло.",
    inputSchema: {
      category: z.string().default("coffee"),
      methods: z.string().optional().describe("Способ приготовления: 1b эспрессо, 3b фильтр, 5a капсулы, 6a дрип-пакеты."),
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
    title: "Расчёт корзины",
    description:
      "Собирает анонимную корзину из списка позиций и возвращает расчёт со стоимостью. "
      + "Заказ не оформляется. optionValueIds — id опций из карточки товара (помол, объём).",
    inputSchema: {
      items: z.array(CartItemSchema).min(1),
      couponCode: z.string().optional(),
    },
    annotations: { readOnlyHint: false },
    handler: (client, { items, couponCode }) => client.createCart(items, couponCode),
  }),
  defineTool({
    name: "create_cart_share_link",
    title: "Ссылка на корзину",
    description:
      "Собирает анонимную корзину и возвращает ссылку на неё — её можно отдать пользователю, "
      + "чтобы он открыл готовую корзину на сайте. Заказ не оформляется.",
    inputSchema: {
      items: z.array(CartItemSchema).min(1),
      couponCode: z.string().optional(),
    },
    annotations: { readOnlyHint: false },
    handler: (client, { items, couponCode }) => client.createCartShareLink(items, couponCode),
  }),
  defineTool({
    name: "recommend_cart",
    title: "Готовая подборка кофе",
    description:
      "Подбирает кофе для эспрессо-машины с высоким рейтингом: отдельно под молочные напитки "
      + "и под чёрный кофе, в указанной фасовке (по умолчанию 250 г), и сразу собирает из них "
      + "анонимную корзину со ссылкой.",
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
