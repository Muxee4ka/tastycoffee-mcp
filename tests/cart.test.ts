import { describe, expect, it } from "vitest";

import { buildCartItem, buildCartLine, buildShareUrl } from "../src/cart.js";

describe("buildCartItem", () => {
  it("matches the cart item shape used by the Tasty Coffee client", () => {
    expect(
      buildCartItem({
        productId: 5,
        quantity: 2,
        optionValueIds: [559, 1936],
      }),
    ).toEqual({
      product_id: 5,
      quantity: 2,
      options: [559, 1936],
      for_gift: null,
    });
  });
});

describe("buildCartLine", () => {
  it("serializes an item into the anonymous shared-cart line format", () => {
    expect(
      buildCartLine({
        product_id: 5,
        quantity: 1,
        options: [559],
        for_gift: null,
      }),
    ).toBe("5::559::1::0");
  });
});

describe("buildShareUrl", () => {
  it("builds the public basket URL from the shared cart uuid", () => {
    expect(buildShareUrl("b604bd0c-32a6-453d-a7c6-438a5b9e4d7a")).toBe(
      "https://shop.tastycoffee.ru/basket?cart=b604bd0c-32a6-453d-a7c6-438a5b9e4d7a",
    );
  });
});
