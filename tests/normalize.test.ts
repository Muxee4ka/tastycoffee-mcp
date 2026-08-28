import { describe, expect, it } from "vitest";

import { normalizeProduct, stripHtml } from "../src/normalize.js";

describe("stripHtml", () => {
  it("turns Tasty Coffee descriptor HTML into readable plain text", () => {
    const html =
      "Плотный кофе с нотами <span><span>тёмной&nbsp;карамели</span>,</span> <span>цукатов</span> и <b>специй</b>";

    expect(stripHtml(html)).toBe("Плотный кофе с нотами тёмной карамели, цукатов и специй");
  });
});

describe("normalizeProduct", () => {
  it("keeps product facts and exposes an absolute product URL", () => {
    const product = normalizeProduct({
      id: 5,
      name: "Кэнди",
      slug: "/coffee/black-candy",
      main_category: "coffee",
      used_for: "Для эспрессо",
      mini_description: "Плотный <b>кофе</b>",
      rating: 4.7,
      reviews_count: 3401,
      price: 679,
      without: 799,
      discount: 15,
      images: ["https://example.test/candy.png"],
      is_archive: false,
      selectable_options: [
        {
          id: 1,
          option: { id: 5, title: "Помол", type: "select" },
          values: [{ id: 10, title: "в зёрнах", price: 0 }],
        },
      ],
      measurable_option: {
        id: 2,
        option: { id: 6, title: "Выберите объем", type: "radio" },
        values: [{ id: 20, title: "250 г", price_without_discount: 799, discount_percent: 15 }],
      },
    });

    expect(product).toMatchObject({
      id: 5,
      name: "Кэнди",
      category: "coffee",
      url: "https://shop.tastycoffee.ru/coffee/black-candy",
      description: "Плотный кофе",
      price: 679,
      priceWithoutDiscount: 799,
      discountPercent: 15,
      available: true,
      options: [
        { id: 2, title: "Выберите объем", type: "radio" },
        { id: 1, title: "Помол", type: "select" },
      ],
    });
  });
});
