import {
  parseAsString,
  parseAsStringLiteral,
  parseAsBoolean,
  parseAsInteger,
  parseAsArrayOf,
} from "nuqs";

// Sort options
export const sortOptions = ["updatedAt-desc", "updatedAt-asc", "name-asc", "name-desc"] as const;
export type SortOption = (typeof sortOptions)[number];

// View modes
export const viewModes = ["grid", "list", "compare"] as const;
export type ViewMode = (typeof viewModes)[number];

// Search params parsers
export const shopSearchParams = {
  // Search query
  q: parseAsString.withDefault(""),

  // Filters (arrays)
  feeds: parseAsArrayOf(parseAsString).withDefault([]),
  brands: parseAsArrayOf(parseAsString).withDefault([]),
  types: parseAsArrayOf(parseAsString).withDefault([]),

  // Sort
  sort: parseAsStringLiteral(sortOptions).withDefault("updatedAt-desc"),

  // View mode
  view: parseAsStringLiteral(viewModes).withDefault("grid"),

  // Compare mode options
  diff: parseAsBoolean.withDefault(false),

  // Pagination
  page: parseAsInteger.withDefault(1),
};

// URL key remapping for shorter URLs
export const shopUrlKeys = {
  q: "q",
  feeds: "f",
  brands: "b",
  types: "t",
  sort: "s",
  view: "v",
  diff: "d",
  page: "p",
} as const;
