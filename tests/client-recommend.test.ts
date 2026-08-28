import { describe, expect, it } from "vitest";

import { TastyCoffeeClient } from "../src/tastycoffee-client.js";

const productBase = {
  slug: "/coffee/sample",
  main_category: "coffee",
  used_for: "Для эспрессо",
  images: [],
  is_archive: false,
  measurable_option: {
    id: 217,
    option: { id: 6, title: "Выберите объем", type: "radio" },
    values: [{ id: 559, title: "250 г", price: 0 }],
  },
  selectable_options: [],
};

function apiProduct(id: number, name: string, isForMilk: boolean) {
  return {
    ...productBase,
    id,
    name,
    rating: 5,
    is_for_milk: isForMilk,
    mini_description: isForMilk
      ? "Плотный кофе с нотами шоколада и орехов"
      : "Сочный кофе с нотами ягод и цитрусов",
  };
}

describe("TastyCoffeeClient.recommendCart", () => {
  it("paginates catalog requests with the API max page size before creating a share link", async () => {
    const requestedLimits: number[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/api/v2/catalog/coffee") {
        const limit = Number(url.searchParams.get("limit"));
        requestedLimits.push(limit);
        if (limit > 12) {
          return Response.json({ message: "too many" }, { status: 422 });
        }
        const page = Number(url.searchParams.get("page") ?? "1");
        return Response.json({
          data: page === 1
            ? [apiProduct(1, "Milk Page One", true)]
            : [apiProduct(2, "Black Page Two", false)],
          meta: { current_page: page, last_page: 2 },
        });
      }

      if (url.pathname === "/api/v2/cart/share") {
        expect(JSON.parse(String(init?.body))).toEqual({
          cart: {
            items: ["1::559::1::0", "2::559::1::0"],
          },
        });
        return Response.json({ uuid: "b604bd0c-32a6-453d-a7c6-438a5b9e4d7a" });
      }

      return Response.json({ message: "unexpected endpoint" }, { status: 500 });
    };

    const result = await new TastyCoffeeClient(fetchImpl).recommendCart({
      milkCount: 1,
      blackCount: 1,
      minRating: 4.9,
      weight: "250 г",
    });

    expect(requestedLimits).toEqual([12, 12]);
    expect(result.share).toMatchObject({
      url: "https://shop.tastycoffee.ru/basket?cart=b604bd0c-32a6-453d-a7c6-438a5b9e4d7a",
    });
  });
});
