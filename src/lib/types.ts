export type RawDeal = {
  externalId: string;
  title: string;
  url: string;
  imageUrl: string | null;
  currentPrice: number;
  originalPrice: number | null;
  currency: string;
  // Lomadee only: brand org id, needed to generate the tracked affiliate link.
  organizationId?: string;
};

export type EvaluatedDeal = RawDeal & {
  discountPercent: number;
  sourceSlug: SourceSlug;
  sourceName: string;
};

export type SourceSlug = "amazon" | "lomadee";
