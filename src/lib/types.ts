export type RawDeal = {
  externalId: string;
  title: string;
  url: string;
  imageUrl: string | null;
  currentPrice: number;
  originalPrice: number | null;
  currency: string;
};

export type EvaluatedDeal = RawDeal & {
  discountPercent: number;
  sourceSlug: SourceSlug;
  sourceName: string;
};

export type SourceSlug = "amazon" | "magalu";
