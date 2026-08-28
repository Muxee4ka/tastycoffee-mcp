export const SHOP_BASE_URL = "https://shop.tastycoffee.ru";

export type CartInputItem = {
  productId: number;
  quantity?: number;
  optionValueIds?: number[];
  forGift?: string | null;
};

export type CartItem = {
  product_id: number;
  quantity: number;
  options: number[];
  for_gift: string | null;
};

export function buildCartItem(input: CartInputItem): CartItem {
  return {
    product_id: input.productId,
    quantity: input.quantity ?? 1,
    options: input.optionValueIds ?? [],
    for_gift: input.forGift ?? null,
  };
}

export function buildCartLine(item: CartItem): string {
  return [
    item.product_id,
    item.options.join(","),
    item.quantity,
    item.for_gift ?? "0",
  ].join("::");
}

export function buildShareUrl(uuid: string): string {
  return `${SHOP_BASE_URL}/basket?cart=${encodeURIComponent(uuid)}`;
}
