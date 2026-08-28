import { SHOP_BASE_URL } from "./cart.js";

type UnknownRecord = Record<string, unknown>;

export type NormalizedOptionValue = {
  id: number | null;
  title: string;
  price: number | null;
  optionValueId: number | null;
  priceWithoutDiscount: number | null;
  discountPercent: number | null;
};

export type NormalizedOption = {
  id: number | null;
  title: string;
  type: string;
  selectedId: number | null;
  values: NormalizedOptionValue[];
};

export type NormalizedProduct = {
  id: number | null;
  name: string;
  slug: string;
  url: string;
  category: string;
  usedFor: string;
  description: string;
  rating: number | null;
  reviewsCount: number | null;
  price: number | null;
  priceWithoutDiscount: number | null;
  discountPercent: number | null;
  available: boolean;
  isForMilk: boolean;
  images: string[];
  processingMethod: string;
  sourness: number | null;
  saturation: number | null;
  options: NormalizedOption[];
};

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function stripHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOption(raw: unknown): NormalizedOption {
  const source = asRecord(raw);
  const option = asRecord(source.option);
  return {
    id: asNumber(source.id),
    title: asString(option.title),
    type: asString(option.type),
    selectedId: asNumber(source.selected_id),
    values: asArray(source.values).map((value) => {
      const item = asRecord(value);
      return {
        id: asNumber(item.id),
        title: asString(item.title),
        price: asNumber(item.price),
        optionValueId: asNumber(item.option_value_id),
        priceWithoutDiscount: asNumber(item.price_without_discount),
        discountPercent: asNumber(item.discount_percent),
      };
    }),
  };
}

export function normalizeProduct(raw: unknown): NormalizedProduct {
  const product = asRecord(raw);
  const slug = asString(product.slug);
  const images = asArray(product.images).filter((image): image is string => typeof image === "string");
  const measurableOption = product.measurable_option ? [product.measurable_option] : [];
  const selectableOptions = asArray(product.selectable_options);

  return {
    id: asNumber(product.id),
    name: asString(product.name),
    slug,
    url: new URL(slug || "/", SHOP_BASE_URL).toString(),
    category: asString(product.main_category),
    usedFor: asString(product.used_for),
    description: stripHtml(asString(product.mini_description)),
    rating: asNumber(product.rating),
    reviewsCount: asNumber(product.reviews_count),
    price: asNumber(product.price),
    priceWithoutDiscount: asNumber(product.without),
    discountPercent: asNumber(product.discount),
    available: product.is_archive !== true,
    isForMilk: product.is_for_milk === true,
    images,
    processingMethod: asString(product.processing_method),
    sourness: asNumber(product.sourness),
    saturation: asNumber(product.saturation),
    options: [...measurableOption, ...selectableOptions].map(normalizeOption),
  };
}

export function normalizeProducts(raw: unknown): NormalizedProduct[] {
  return asArray(raw).map(normalizeProduct);
}

export function normalizeReview(raw: unknown): UnknownRecord {
  const review = asRecord(raw);
  const user = asRecord(review.user);
  return {
    id: review.id,
    message: stripHtml(asString(review.message ?? review.desc ?? review.shop_desc)),
    rating: review.rating,
    createdAt: review.created_at,
    user: {
      name: user.name,
      city: user.city,
      level: user.level,
    },
  };
}
