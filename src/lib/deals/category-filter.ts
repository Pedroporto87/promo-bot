const DIACRITICS_PATTERN = /[̀-ͯ]/g;

function normalize(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS_PATTERN, "").toLowerCase();
}

function getKeywords(): string[] {
  const raw = process.env.CATEGORY_KEYWORDS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((keyword) => normalize(keyword.trim()))
    .filter(Boolean);
}

/** With no CATEGORY_KEYWORDS configured, everything passes. Otherwise the title must contain at least one keyword. */
export function matchesCategoryFilter(title: string): boolean {
  const keywords = getKeywords();
  if (keywords.length === 0) return true;

  const normalizedTitle = normalize(title);
  return keywords.some((keyword) => normalizedTitle.includes(keyword));
}
