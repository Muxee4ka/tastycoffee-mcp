import { buildCartItem, buildCartLine, buildShareUrl, type CartInputItem } from "./cart.js";
import { normalizeProduct, normalizeProducts, normalizeReview } from "./normalize.js";
import { recommendCartFromProducts, type RecommendCartInput } from "./recommend.js";

const API_BASE_URL = "https://shop.tastycoffee.ru/api/v2/";
const STORAGE_BASE_URL = "https://shop.tastycoffee.ru/api/storage/";

type JsonObject = Record<string, unknown>;

export type CatalogQuery = {
  category?: string;
  slug?: string;
  q?: string;
  methods?: string;
  categories?: string;
  filters?: string;
  type?: number;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
  first?: number;
};

export class TastyCoffeeClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async searchProducts(query: string, limit = 12, page = 1): Promise<JsonObject> {
    const response = await this.getApi("products", { q: query, limit, page });
    return {
      ...response,
      data: normalizeProducts(response.data),
    };
  }

  async listCatalog(query: CatalogQuery = {}): Promise<JsonObject> {
    const category = query.category ?? "coffee";
    const { category: _category, slug, ...params } = query;
    const path = ["catalog", category, slug].filter(Boolean).join("/");
    const response = await this.getApi(path, params);
    return {
      ...response,
      data: Array.isArray(response.data) ? normalizeProducts(response.data) : normalizeProduct(response.data),
    };
  }

  async getProduct(slug: string, category = "coffee"): Promise<JsonObject> {
    return this.listCatalog({ category, slug: slug.replace(/^\/+/, "") });
  }

  async getProductPrices(productIds: number[], coupon?: string): Promise<JsonObject> {
    return this.postApi("products/prices", {
      product_ids: productIds,
      ...(coupon ? { coupon } : {}),
    });
  }

  async getProductReviews(productId: number, page = 1, limit = 5): Promise<JsonObject> {
    const response = await this.getApi(`products/${productId}/reviews`, { page, limit });
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data.map(normalizeReview) : [],
    };
  }

  async getCatalogFilters(category = "coffee", method?: string): Promise<unknown> {
    return this.getApi(`filters/${category}`, method ? { method } : {});
  }

  async getHomeBlocks(): Promise<JsonObject> {
    return this.getStorage("main");
  }

  async getSettings(): Promise<JsonObject> {
    return this.getApi("settings");
  }

  async getCityDeliverySummary(cityId?: string): Promise<JsonObject> {
    return this.getApi("city", cityId ? { city_id: cityId } : {});
  }

  async createCart(items: CartInputItem[], couponCode?: string): Promise<JsonObject> {
    const cartItems = items.map((item) => buildCartLine(buildCartItem(item)));
    const cart = {
      items: cartItems,
      ...(couponCode ? { coupon_code: couponCode } : {}),
    };
    const response = await this.postApi("cart", { cart });
    return {
      ...response,
      sharePayload: { cart },
    };
  }

  async createCartShareLink(items: CartInputItem[], couponCode?: string): Promise<JsonObject> {
    const cartItems = items.map((item) => buildCartLine(buildCartItem(item)));
    const cart = {
      items: cartItems,
      ...(couponCode ? { coupon_code: couponCode } : {}),
    };
    const response = await this.postApi("cart/share", { cart });
    const uuid = typeof response.uuid === "string" ? response.uuid : "";
    return {
      uuid,
      url: uuid ? buildShareUrl(uuid) : "",
      raw: response,
      cart,
    };
  }

  async recommendCart(input: RecommendCartInput & { couponCode?: string } = {}): Promise<JsonObject> {
    const products = await this.listRecommendationCatalogProducts();
    const recommendation = recommendCartFromProducts(products, input);
    const share = recommendation.items.length
      ? await this.createCartShareLink(recommendation.items, input.couponCode)
      : null;

    return {
      ...recommendation,
      share,
    };
  }

  /**
   * The catalog API paginates at a fixed page size and offers no discount facet,
   * so any whole-catalog question (discounts, recommendations) has to walk the
   * pages. Capped so a broken `last_page` cannot spin forever.
   */
  async crawlCatalog(query: CatalogQuery = {}, maxPages = 20): Promise<ReturnType<typeof normalizeProducts>> {
    const products: ReturnType<typeof normalizeProducts> = [];
    const pageSize = query.limit ?? 12;
    let page = 1;
    let lastPage = 1;

    do {
      const catalog = await this.listCatalog({
        ...query,
        limit: pageSize,
        first: pageSize,
        page,
      });
      if (Array.isArray(catalog.data)) {
        products.push(...catalog.data);
      }
      const meta = catalog.meta && typeof catalog.meta === "object"
        ? catalog.meta as { last_page?: unknown }
        : {};
      lastPage = typeof meta.last_page === "number" ? meta.last_page : page;
      page += 1;
    } while (page <= lastPage && page <= maxPages);

    return products;
  }

  async listDiscountedProducts(
    query: CatalogQuery = {},
    minDiscountPercent = 1,
    limit = 20,
  ): Promise<JsonObject> {
    const scanned = await this.crawlCatalog(query);
    const discounted = scanned
      .filter((product) => (product.discountPercent ?? 0) >= minDiscountPercent)
      .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));

    return {
      data: discounted.slice(0, limit),
      meta: {
        scanned: scanned.length,
        matched: discounted.length,
        returned: Math.min(discounted.length, limit),
        minDiscountPercent,
      },
    };
  }

  private async listRecommendationCatalogProducts(): Promise<ReturnType<typeof normalizeProducts>> {
    return this.crawlCatalog({ category: "coffee", methods: "1b" });
  }

  private async getApi(path: string, query: Record<string, unknown> = {}): Promise<JsonObject> {
    return this.request(new URL(path, API_BASE_URL), { method: "GET", query });
  }

  private async postApi(path: string, body: unknown): Promise<JsonObject> {
    return this.request(new URL(path, API_BASE_URL), { method: "POST", body });
  }

  private async getStorage(path: string): Promise<JsonObject> {
    return this.request(new URL(path, STORAGE_BASE_URL), { method: "GET" });
  }

  private async request(
    url: URL,
    options: { method: "GET" | "POST"; query?: Record<string, unknown>; body?: unknown },
  ): Promise<JsonObject> {
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await this.fetchImpl(url, {
      method: options.method,
      headers: {
        "accept": "application/json,text/plain,*/*",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 tastycoffee-mcp/0.1.0",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) as JsonObject : {};
    if (!response.ok) {
      const message = typeof data.message === "string" ? data.message : response.statusText;
      throw new Error(`${response.status} ${message}`);
    }
    return data;
  }
}
