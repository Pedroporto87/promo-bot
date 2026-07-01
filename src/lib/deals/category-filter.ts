import { getEnv } from "@/lib/env";

const DIACRITICS_PATTERN = /[̀-ͯ]/g;

function normalize(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS_PATTERN, "").toLowerCase();
}

// Built-in keywords for the three target categories. CATEGORY_KEYWORDS env var adds to these.
const BASE_KEYWORDS: readonly string[] = [
  // --- Limpeza ---
  "limpeza",
  "detergente",
  "sabao",
  "sabao em po",
  "amaciante",
  "alvejante",
  "tira mancha",
  "tira-mancha",
  "desinfetante",
  "multiuso",
  "limpador",
  "desengordurante",
  "agua sanitaria",
  "esponja",
  "esponja de aco",
  "pano de limpeza",
  "pano de prato",
  "luva de borracha",
  "rodo",
  "vassoura",
  "balde",
  "limpa forno",
  "limpa banheiro",
  "limpa vidro",
  "tira gordura",
  "desentupidor",
  // --- Bem-estar ---
  "higiene",
  "sabonete",
  "shampoo",
  "xampu",
  "condicionador",
  "fralda",
  "toalha umedecida",
  "lenco umido",
  "cotonete",
  "algodao",
  "antisseptico",
  "alcool gel",
  "alcool 70",
  "curativo",
  "band-aid",
  "termometro",
  "vitamina",
  "suplemento",
  "colageno",
  "probiotico",
  "melatonina",
  "omega",
  "magnesio",
  "zinco",
  "pasta de dente",
  "creme dental",
  "fio dental",
  "escova de dentes",
  "enxaguante bucal",
  "absorvente",
  "talco",
  "desodorante",
  "antiperspirante",
  // --- Cosméticos ---
  "cosmetico",
  "maquiagem",
  "hidratante",
  "creme",
  "locao",
  "serum",
  "protetor solar",
  "perfume",
  "capilar",
  "tratamento capilar",
  "escova de cabelo",
  "esfoliante",
  "base de maquiagem",
  "base liquida",
  "batom",
  "pincel",
  "pinceis",
  "blush",
  "sombra",
  "rimel",
  "mascara de cilios",
  "delineador",
  "primer",
  "iluminador",
  "contorno",
  "lip gloss",
  "esmalte",
  "removedor de esmalte",
  "demaquilante",
  "tonico facial",
  "agua micelar",
  "oleo facial",
  "ampola",
  "mascara facial",
  "niacinamida",
  "acido hialuronico",
  "retinol",
  "vitamina c facial",
  "protetor labial",
  "bb cream",
  "cc cream",
  "modelador",
  "finalizador",
  "gel para cabelo",
];

// Cached at module load so we don't re-parse on every product evaluated.
let cachedKeywords: string[] | null = null;

function getKeywords(): string[] {
  if (cachedKeywords !== null) return cachedKeywords;

  const base = BASE_KEYWORDS.map((k) => normalize(k));

  const raw = getEnv("CATEGORY_KEYWORDS");
  const extra = raw
    ? raw
        .split(",")
        .map((k) => normalize(k.trim()))
        .filter(Boolean)
    : [];

  // Merge: base + extra, deduped.
  cachedKeywords = [...new Set([...base, ...extra])];
  return cachedKeywords;
}

/** With no keywords configured, everything passes. Otherwise the title must match at least one. */
export function matchesCategoryFilter(title: string): boolean {
  const keywords = getKeywords();
  if (keywords.length === 0) return true;

  const normalizedTitle = normalize(title);
  return keywords.some((keyword) => normalizedTitle.includes(keyword));
}
