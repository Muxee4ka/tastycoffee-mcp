import { describe, expect, it } from "vitest";

import { recommendCartFromProducts } from "../src/recommend.js";
import { normalizeProduct } from "../src/normalize.js";

const baseProduct = {
  main_category: "coffee",
  used_for: "Для эспрессо",
  slug: "/coffee/example",
  images: [],
  is_archive: false,
  selectable_options: [],
  measurable_option: {
    id: 217,
    option: { id: 6, title: "Выберите объем", type: "radio" },
    values: [
      { id: 559, title: "250 г", price: 0 },
      { id: 560, title: "1000 г", price: 1560 },
    ],
  },
};

function product(overrides: Record<string, unknown>) {
  return normalizeProduct({ ...baseProduct, ...overrides });
}

describe("recommendCartFromProducts", () => {
  it("selects rated 250g milk and black coffees with different taste profiles", () => {
    const result = recommendCartFromProducts(
      [
        product({
          id: 1,
          name: "Milk Nut",
          rating: 4.9,
          is_for_milk: true,
          mini_description: "Плотный кофе с нотами шоколада, орехов и карамели",
          saturation: 5,
          sourness: 1,
        }),
        product({
          id: 2,
          name: "Milk Spice",
          rating: 5,
          is_for_milk: true,
          mini_description: "Плотный кофе с нотами специй, какао и нуги",
          saturation: 5,
          sourness: 1,
        }),
        product({
          id: 3,
          name: "Black Berry",
          rating: 4.95,
          is_for_milk: false,
          mini_description: "Сочный кофе с нотами ягод, цитрусов и цветов",
          saturation: 3,
          sourness: 4,
        }),
        product({
          id: 4,
          name: "Black Tea",
          rating: 4.9,
          is_for_milk: false,
          mini_description: "Сочный кофе с нотами чёрного чая, яблока и какао",
          saturation: 3,
          sourness: 3,
        }),
        product({
          id: 5,
          name: "Too Low",
          rating: 4.8,
          is_for_milk: true,
          mini_description: "Плотный кофе с нотами шоколада",
        }),
      ],
      { minRating: 4.9, milkCount: 2, blackCount: 2, weight: "250 г" },
    );

    expect(result.items).toEqual([
      { productId: 2, quantity: 1, optionValueIds: [559] },
      { productId: 1, quantity: 1, optionValueIds: [559] },
      { productId: 3, quantity: 1, optionValueIds: [559] },
      { productId: 4, quantity: 1, optionValueIds: [559] },
    ]);
    expect(result.milk.map((item) => item.name)).toEqual(["Milk Spice", "Milk Nut"]);
    expect(result.black.map((item) => item.name)).toEqual(["Black Berry", "Black Tea"]);
    expect(result.warnings).toEqual([]);
  });

  it("warns when a matching product has no requested weight option", () => {
    const result = recommendCartFromProducts(
      [
        normalizeProduct({
          ...baseProduct,
          id: 1,
          name: "No Small Pack",
          rating: 5,
          is_for_milk: true,
          mini_description: "Плотный кофе с нотами шоколада",
          measurable_option: {
            id: 217,
            option: { id: 6, title: "Выберите объем", type: "radio" },
            values: [{ id: 560, title: "1000 г", price: 1560 }],
          },
        }),
      ],
      { minRating: 4.9, milkCount: 1, blackCount: 0, weight: "250 г" },
    );

    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual([
      "Not enough milk coffees matched the criteria: requested 1, selected 0.",
    ]);
  });
});
