/**
 * Catalog facets as the shop's sidebar exposes them.
 *
 * The API takes one flat `filters` query param of numeric ids. Ids from the same
 * group are OR-ed, ids from different groups are AND-ed — verified against the
 * live catalog: Эфиопия alone is 22 products, Натуральный alone is 22, together
 * they are 3, while Эфиопия + Колумбия is 48. So resolving a selection is just a
 * matter of concatenating the ids of every chosen value.
 *
 * A single label can map to several ids (`низкая` acidity is `56,36,37`), which
 * is the shop's own grouping and already behaves as OR.
 *
 * These ids come from `GET /api/v2/filters/coffee`. They are stable in practice,
 * but `get_catalog_filters` stays the authority. `TASTYCOFFEE_LIVE=1 npm test`
 * checks this table against the live catalog.
 */

export type Facet = {
  /** Sidebar group title, shown on the landing page. */
  label: string;
  /** Whether picking several values at once is meaningful. */
  multi: boolean;
  values: Record<string, string>;
};

export const ACIDITY = {
  "низкая": "56,36,37",
  "средняя": "38",
  "высокая": "39,40",
} as const;

export const BODY = {
  "низкая": "57,58",
  "средняя": "59",
  "высокая": "60,61",
} as const;

export const ROAST = {
  "светлая": "64",
  "средняя": "65",
  "тёмная": "66",
} as const;

export const FLAVOR = {
  "шоколад/орехи": "72",
  "цветы/цитрусы": "20",
  "фрукты/ягоды": "17",
  "алкоголь/фанки": "83",
} as const;

export const PROCESSING = {
  "мытый": "42",
  "натуральный": "41",
  "хани": "148",
  "фанки": "88",
  "смесь": "131",
  "другой": "45",
} as const;

export const ORIGIN = {
  "бразилия": "91",
  "эфиопия": "92",
  "колумбия": "93",
  "коста-рика": "94",
  "кения": "95",
  "руанда": "97",
  "уганда": "98",
  "перу": "99",
  "бурунди": "103",
  "гватемала": "105",
  "индонезия": "108",
  "йемен": "113",
  "китай": "123",
  "боливия": "124",
  "малайзия": "158",
} as const;

export const FEATURE = {
  "смесь": "75",
  "без кофеина": "69",
  "моносорт": "34",
  "микролот": "28",
  "для молочных напитков": "87",
  "limited edition": "111",
} as const;

export const CATALOG_FACETS = {
  acidity: { label: "Кислотность", multi: false, values: ACIDITY },
  body: { label: "Плотность", multi: false, values: BODY },
  roast: { label: "Степень обжарки", multi: true, values: ROAST },
  flavor: { label: "Вкус кофе", multi: true, values: FLAVOR },
  processing: { label: "Способ обработки", multi: true, values: PROCESSING },
  origin: { label: "Страна произрастания", multi: true, values: ORIGIN },
  feature: { label: "Особенность кофе", multi: true, values: FEATURE },
} as const satisfies Record<string, Facet>;

export type FacetName = keyof typeof CATALOG_FACETS;

export const FACET_NAMES = Object.keys(CATALOG_FACETS) as FacetName[];

/**
 * `type` in the catalog API — the shop's own curated collections. `новинки` is
 * the one that answers "what is new", there is no sort-by-date in the API.
 */
export const COLLECTIONS = {
  "рекомендуем": 30,
  "популярное": 31,
  "новинки": 32,
  "сорт недели": 71,
  "заканчивается": 79,
  "микролот": 28,
} as const;

export type CollectionName = keyof typeof COLLECTIONS;

/** `bought_before` is deliberately absent: it needs a logged-in account, and this server is anonymous. */

export type FacetSelection = Partial<Record<FacetName, string | string[] | undefined>>;

function facetIds(facet: Facet, value: string): string {
  const ids = facet.values[value.trim().toLowerCase()];
  if (ids === undefined) {
    throw new Error(
      `Недопустимое значение фильтра «${facet.label}»: "${value}". `
      + `Допустимые: ${Object.keys(facet.values).join(", ")}.`,
    );
  }
  return ids;
}

/**
 * Turns a human selection into the comma-joined id list the API expects,
 * preserving facet order and dropping duplicates.
 */
export function resolveFilterIds(selection: FacetSelection, extra?: string): string {
  const ids: string[] = [];

  for (const name of FACET_NAMES) {
    const chosen = selection[name];
    if (chosen === undefined) {
      continue;
    }
    const facet = CATALOG_FACETS[name] as Facet;
    for (const value of Array.isArray(chosen) ? chosen : [chosen]) {
      ids.push(...facetIds(facet, value).split(","));
    }
  }

  if (extra) {
    ids.push(...extra.split(","));
  }

  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].join(",");
}

export function resolveCollection(name: string): number {
  const id = COLLECTIONS[name.trim().toLowerCase() as CollectionName];
  if (id === undefined) {
    throw new Error(
      `Недопустимая подборка "${name}". Допустимые: ${Object.keys(COLLECTIONS).join(", ")}.`,
    );
  }
  return id;
}
