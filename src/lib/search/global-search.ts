export function normalizeSearchQuery(input: string, maxLength = 80) {
  return input
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function postgrestContainsFilter(fields: string[], input: string) {
  const value = normalizeSearchQuery(input)
    // `.or()` uses PostgREST's raw filter grammar. Keep user input out of its
    // separators and wildcard operators while preserving Chinese and codes.
    .replace(/[^\p{L}\p{N}\s\-/.@]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!value || fields.length === 0) return null;
  return fields.map((field) => `${field}.ilike.%${value}%`).join(",");
}

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .trim();
}

export function searchResultScore(
  input: string,
  values: unknown[],
  identifierValues: unknown[] = [],
) {
  const query = normalized(input);
  if (!query) return 0;

  const identifiers = identifierValues.map(normalized).filter(Boolean);
  if (identifiers.some((value) => value === query)) return 100;
  if (identifiers.some((value) => value.startsWith(query))) return 80;

  const searchable = values.map(normalized).filter(Boolean);
  if (searchable.some((value) => value === query)) return 70;
  if (searchable.some((value) => value.startsWith(query))) return 55;
  if (searchable.some((value) => value.includes(query))) return 35;
  return 0;
}

export function rankSearchResults<T>(
  rows: T[],
  input: string,
  values: (row: T) => unknown[],
  identifiers: (row: T) => unknown[] = () => [],
  limit = 5,
) {
  return rows
    .map((row, index) => ({
      row,
      index,
      score: searchResultScore(input, values(row), identifiers(row)),
    }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.index - right.index,
    )
    .slice(0, limit)
    .map((item) => item.row);
}
