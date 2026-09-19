export type CategoryInput = {
  categoryCode: string;
  spend: number;
  percentChange: number;
};

export type CategoryContribution = {
  categoryCode: string;
  weight: number;
  percentChange: number;
  contribution: number;
};

export type PersonalInflationResult = {
  personalInflationRate: number;
  contributions: CategoryContribution[];
};

export function calculatePersonalInflation(
  categories: CategoryInput[]
): PersonalInflationResult {
  const totalSpend = categories.reduce((sum, c) => sum + c.spend, 0);

  if (totalSpend <= 0) {
    throw new Error("Total spend must be greater than zero");
  }

  const contributions = categories.map((c) => {
    const weight = c.spend / totalSpend;
    return {
      categoryCode: c.categoryCode,
      weight,
      percentChange: c.percentChange,
      contribution: weight * c.percentChange,
    };
  });

  const personalInflationRate = contributions.reduce(
    (sum, c) => sum + c.contribution,
    0
  );

  return { personalInflationRate, contributions };
}
