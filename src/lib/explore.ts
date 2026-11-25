/** The oldest year the Explore year filter offers. "All years" still shows older projects. */
export const FIRST_FILTER_YEAR = 2024;

/** Newest first: from this year back to the first one. */
export function filterYears(currentYear: number): number[] {
  const count = Math.max(1, currentYear - FIRST_FILTER_YEAR + 1);
  return Array.from({ length: count }, (_, i) => FIRST_FILTER_YEAR + count - 1 - i);
}

/** The access filter. It only narrows published teasers by a value that is already public. */
export const ACCESS_FILTERS = ["open", "by_request"] as const;
export type AccessFilter = (typeof ACCESS_FILTERS)[number];

export function parseAccessFilter(value: unknown): AccessFilter | undefined {
  return ACCESS_FILTERS.find((a) => a === value);
}

/** A year from the address bar, or undefined when it is not one the filter offers. */
export function parseFilterYear(value: unknown, currentYear: number): number | undefined {
  const year = typeof value === "string" ? Number(value) : NaN;
  return filterYears(currentYear).includes(year) ? year : undefined;
}
