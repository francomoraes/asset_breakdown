export interface DerivedFields {
  investedValueCents: number;
  currentValueCents: number;
  resultCents: number;
  returnPercentage: number;
}

export function calculateDerivedFields(
  quantity: number,
  averagePriceCents: number,
  currentPriceCents: number,
  dividendsCentsAccumulated: number = 0,
): DerivedFields {
  const investedValueCents = Math.round(quantity * averagePriceCents);
  const currentValueCents = Math.round(quantity * currentPriceCents);
  const resultCents =
    currentValueCents - investedValueCents + dividendsCentsAccumulated;

  const returnPercentage =
    investedValueCents > 0
      ? Number(((resultCents / investedValueCents) * 100).toFixed(2))
      : 0;

  return {
    investedValueCents,
    currentValueCents,
    resultCents,
    returnPercentage,
  };
}
