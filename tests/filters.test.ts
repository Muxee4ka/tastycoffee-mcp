import { describe, expect, it } from "vitest";

import { CATALOG_FACETS, COLLECTIONS, FACET_NAMES, resolveCollection, resolveFilterIds } from "../src/filters.js";
import { TastyCoffeeClient } from "../src/tastycoffee-client.js";

describe("resolveFilterIds", () => {
  it("returns an empty string for an empty selection", () => {
    expect(resolveFilterIds({})).toBe("");
  });

  it("expands a label that maps to several ids", () => {
    expect(resolveFilterIds({ acidity: "низкая" })).toBe("56,36,37");
  });

  it("joins values across facets in facet order", () => {
    expect(resolveFilterIds({ origin: ["эфиопия"], processing: ["натуральный"], flavor: ["фрукты/ягоды"] }))
      .toBe("17,41,92");
  });

  it("accepts several values from one facet", () => {
    expect(resolveFilterIds({ origin: ["эфиопия", "колумбия"] })).toBe("92,93");
  });

  it("merges raw filter ids and drops duplicates", () => {
    expect(resolveFilterIds({ origin: ["эфиопия"] }, "92,111")).toBe("92,111");
  });

  it("is case and whitespace tolerant", () => {
    expect(resolveFilterIds({ roast: [" Тёмная "] })).toBe("66");
  });

  it("names the allowed values when given an unknown one", () => {
    expect(() => resolveFilterIds({ roast: ["очень тёмная"] }))
      .toThrow(/Степень обжарки.*светлая, средняя, тёмная/s);
  });
});

describe("resolveCollection", () => {
  it("maps новинки onto the catalog type id", () => {
    expect(resolveCollection("новинки")).toBe(32);
  });

  it("names the allowed collections when given an unknown one", () => {
    expect(() => resolveCollection("акции")).toThrow(/Allowed: рекомендуем/);
  });
});

describe("catalog facet vocabulary", () => {
  it("uses lowercase keys so lookups are predictable", () => {
    for (const name of FACET_NAMES) {
      for (const value of Object.keys(CATALOG_FACETS[name].values)) {
        expect(value).toBe(value.toLowerCase());
      }
    }
  });

  it("only ever maps to numeric ids", () => {
    const ids = [
      ...FACET_NAMES.flatMap((name) => Object.values(CATALOG_FACETS[name].values)),
    ];
    for (const id of ids) {
      expect(id).toMatch(/^\d+(,\d+)*$/);
    }
    expect(Object.values(COLLECTIONS).every(Number.isInteger)).toBe(true);
  });
});

// The facet ids are hardcoded for discoverability; this guards against the shop
// renumbering them. Opt in with TASTYCOFFEE_LIVE=1 so the suite stays offline.
describe.runIf(process.env.TASTYCOFFEE_LIVE === "1")("live filter vocabulary", () => {
  it("still matches the ids the shop publishes", async () => {
    const groups = await new TastyCoffeeClient().getCatalogFilters("coffee") as {
      name?: string;
      options?: { value?: string; name?: string }[];
    }[];

    // Every sidebar group is published under the same name ("filters"), so the
    // published values are the only reliable thing to match against.
    const published = new Set<string>();
    for (const group of groups) {
      for (const option of group.options ?? []) {
        if (option.value) {
          published.add(option.value);
        }
      }
    }

    const stale: string[] = [];
    for (const name of FACET_NAMES) {
      for (const [label, ids] of Object.entries(CATALOG_FACETS[name].values)) {
        if (!published.has(ids)) {
          stale.push(`${name}.${label} -> ${ids}`);
        }
      }
    }
    for (const [label, id] of Object.entries(COLLECTIONS)) {
      if (!published.has(String(id))) {
        stale.push(`collection.${label} -> ${id}`);
      }
    }

    expect(stale).toEqual([]);
  }, 30_000);
});

describe("TastyCoffeeClient.listDiscountedProducts", () => {
  it("walks every catalog page and returns discounted products, deepest discount first", async () => {
    const pages = [
      [
        { id: 1, name: "Full price", slug: "/coffee/a", price: 900, without: 0, discount: 0 },
        { id: 2, name: "Small cut", slug: "/coffee/b", price: 950, without: 1000, discount: 5 },
      ],
      [
        { id: 3, name: "Deep cut", slug: "/coffee/c", price: 700, without: 1000, discount: 30 },
      ],
    ];
    const seenPages: number[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get("page") ?? "1");
      seenPages.push(page);
      return Response.json({ data: pages[page - 1] ?? [], meta: { current_page: page, last_page: 2 } });
    };

    const result = await new TastyCoffeeClient(fetchImpl).listDiscountedProducts({ category: "coffee" }, 1, 10);

    expect(seenPages).toEqual([1, 2]);
    expect(result.meta).toEqual({ scanned: 3, matched: 2, returned: 2, minDiscountPercent: 1 });
    expect((result.data as { name: string }[]).map((product) => product.name))
      .toEqual(["Deep cut", "Small cut"]);
  });

  it("honours minDiscountPercent and limit", async () => {
    const fetchImpl: typeof fetch = async () => Response.json({
      data: [
        { id: 1, name: "Small cut", slug: "/coffee/b", price: 950, without: 1000, discount: 5 },
        { id: 2, name: "Deep cut", slug: "/coffee/c", price: 700, without: 1000, discount: 30 },
      ],
      meta: { current_page: 1, last_page: 1 },
    });

    const result = await new TastyCoffeeClient(fetchImpl).listDiscountedProducts({}, 10, 1);

    expect(result.meta).toMatchObject({ matched: 1, returned: 1 });
    expect((result.data as { name: string }[])[0]!.name).toBe("Deep cut");
  });
});

describe("TastyCoffeeClient network retry", () => {
  it("retries a connection failure and succeeds", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) {
        throw new TypeError("fetch failed");
      }
      return Response.json({ data: [], meta: { current_page: 1, last_page: 1 } });
    };

    const result = await new TastyCoffeeClient(fetchImpl).listCatalog({ category: "coffee" });

    expect(calls).toBe(2);
    expect(result.data).toEqual([]);
  });

  it("gives up after the last attempt and surfaces the error", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      throw new TypeError("fetch failed");
    };

    await expect(new TastyCoffeeClient(fetchImpl).listCatalog({ category: "coffee" }))
      .rejects.toThrow("fetch failed");
    expect(calls).toBe(3);
  });

  it("does not retry an HTTP error status", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return Response.json({ message: "nope" }, { status: 422 });
    };

    await expect(new TastyCoffeeClient(fetchImpl).listCatalog({ category: "coffee" }))
      .rejects.toThrow("422 nope");
    expect(calls).toBe(1);
  });
});
