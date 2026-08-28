import type { CartInputItem } from "./cart.js";
import type { NormalizedProduct } from "./normalize.js";

export type RecommendCartInput = {
  minRating?: number;
  milkCount?: number;
  blackCount?: number;
  weight?: string;
};

export type RecommendedProduct = Pick<
  NormalizedProduct,
  "id" | "name" | "url" | "description" | "rating" | "price" | "isForMilk" | "sourness" | "saturation"
> & {
  selectedWeightOptionId: number;
  tasteKey: string;
  reason: string;
};

export type RecommendCartResult = {
  criteria: Required<RecommendCartInput>;
  milk: RecommendedProduct[];
  black: RecommendedProduct[];
  items: CartInputItem[];
  warnings: string[];
};

const DEFAULTS: Required<RecommendCartInput> = {
  minRating: 4.9,
  milkCount: 3,
  blackCount: 3,
  weight: "250 г",
};

const TASTE_WORDS = [
  "шоколад",
  "орех",
  "карамел",
  "какао",
  "спец",
  "нуг",
  "ягод",
  "цитрус",
  "цвет",
  "чай",
  "яблок",
  "виш",
  "апельс",
  "смород",
  "фрукт",
  "алкогол",
  "фанк",
];

function selectedWeightOptionId(product: NormalizedProduct, weight: string): number | null {
  for (const option of product.options) {
    for (const value of option.values) {
      if (value.title.trim().toLowerCase() === weight.trim().toLowerCase()) {
        return value.id;
      }
    }
  }
  return null;
}

function tasteKey(product: NormalizedProduct): string {
  const description = product.description.toLowerCase();
  return TASTE_WORDS.find((word) => description.includes(word)) ?? product.processingMethod ?? product.name;
}

function reason(product: NormalizedProduct, role: "milk" | "black"): string {
  if (role === "milk") {
    return "High-rated espresso coffee marked as suitable for milk drinks.";
  }
  if ((product.sourness ?? 0) >= 3) {
    return "High-rated espresso coffee with brighter acidity for drinking black.";
  }
  return "High-rated espresso coffee not marked as milk-focused.";
}

function score(product: NormalizedProduct, role: "milk" | "black"): number {
  const rating = product.rating ?? 0;
  const milkBonus = role === "milk" && product.isForMilk ? 1 : 0;
  const blackBonus = role === "black" ? (product.sourness ?? 0) / 10 : (product.saturation ?? 0) / 10;
  return rating * 10 + milkBonus + blackBonus;
}

function pick(
  products: NormalizedProduct[],
  role: "milk" | "black",
  count: number,
  weight: string,
): RecommendedProduct[] {
  const pool = products
    .filter((product) => role === "milk" ? product.isForMilk : !product.isForMilk)
    .map((product) => ({ product, weightOptionId: selectedWeightOptionId(product, weight) }))
    .filter((entry): entry is { product: NormalizedProduct; weightOptionId: number } => entry.weightOptionId !== null)
    .sort((a, b) => score(b.product, role) - score(a.product, role));

  const selected: RecommendedProduct[] = [];
  const usedTasteKeys = new Set<string>();

  for (const entry of pool) {
    const key = tasteKey(entry.product);
    if (usedTasteKeys.has(key) && selected.length + 1 < count) {
      continue;
    }
    selected.push({
      id: entry.product.id,
      name: entry.product.name,
      url: entry.product.url,
      description: entry.product.description,
      rating: entry.product.rating,
      price: entry.product.price,
      isForMilk: entry.product.isForMilk,
      sourness: entry.product.sourness,
      saturation: entry.product.saturation,
      selectedWeightOptionId: entry.weightOptionId,
      tasteKey: key,
      reason: reason(entry.product, role),
    });
    usedTasteKeys.add(key);
    if (selected.length === count) {
      break;
    }
  }

  return selected;
}

export function recommendCartFromProducts(
  products: NormalizedProduct[],
  input: RecommendCartInput = {},
): RecommendCartResult {
  const criteria = { ...DEFAULTS, ...input };
  const eligible = products.filter(
    (product) => product.available && (product.rating ?? 0) >= criteria.minRating,
  );
  const milk = pick(eligible, "milk", criteria.milkCount, criteria.weight);
  const black = pick(eligible, "black", criteria.blackCount, criteria.weight);
  const selected = [...milk, ...black];
  const warnings: string[] = [];

  if (milk.length < criteria.milkCount) {
    warnings.push(`Not enough milk coffees matched the criteria: requested ${criteria.milkCount}, selected ${milk.length}.`);
  }
  if (black.length < criteria.blackCount) {
    warnings.push(`Not enough black coffees matched the criteria: requested ${criteria.blackCount}, selected ${black.length}.`);
  }

  return {
    criteria,
    milk,
    black,
    items: selected.map((product) => ({
      productId: product.id ?? 0,
      quantity: 1,
      optionValueIds: [product.selectedWeightOptionId],
    })),
    warnings,
  };
}
