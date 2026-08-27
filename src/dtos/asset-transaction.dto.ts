import { z } from "zod";
import { createPaginationQueryDto } from "./pagination.dto";
import { ALLOWED_SORT_FIELDS_ASSET_TRANSACTION } from "enums/allowed-sort-fields-asset-transaction.enum";
import { AssetTransactionType } from "enums/asset-transaction-type.enum";

function todayIsoDate(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

const dateSchema = z
  .string({ required_error: "A data é obrigatória" })
  .refine((val) => !Number.isNaN(Date.parse(val)), { message: "Data inválida" })
  .refine(
    (val) => val.slice(0, 10) <= todayIsoDate(),
    { message: "Não é possível lançar uma operação com data futura" },
  );

const identificationShape = {
  assetId: z.number().int().positive().optional(),
  ticker: z
    .string()
    .min(1)
    .transform((val) => val.toUpperCase())
    .optional(),
  assetTypeName: z.string().min(1).optional(),
  institutionId: z.number().int().positive().optional(),
  currency: z.enum(["BRL", "USD"]).optional(),
};

const buySellShape = {
  date: dateSchema,
  quantity: z
    .number({ required_error: "A quantidade é obrigatória" })
    .positive("A quantidade deve ser maior que zero"),
  unitPriceCents: z
    .number({ required_error: "O preço unitário em centavos é obrigatório" })
    .int("O preço unitário deve ser um número inteiro")
    .nonnegative("O preço unitário deve ser positivo"),
  feesCents: z
    .number()
    .int("As taxas devem ser um número inteiro")
    .nonnegative("As taxas devem ser positivas")
    .optional()
    .default(0),
};

const dividendShape = {
  date: dateSchema,
  totalAmountCents: z
    .number({ required_error: "O valor recebido em centavos é obrigatório" })
    .int("O valor deve ser um número inteiro")
    .positive("O valor recebido deve ser maior que zero"),
};

function checkAssetIdentification(
  data: { assetId?: number; ticker?: string; assetTypeName?: string; institutionId?: number; currency?: string },
  ctx: z.RefinementCtx,
) {
  const hasAssetId = data.assetId !== undefined;
  const hasAnyTickerField =
    data.ticker !== undefined ||
    data.assetTypeName !== undefined ||
    data.institutionId !== undefined ||
    data.currency !== undefined;
  const hasTickerBundle =
    data.ticker !== undefined &&
    data.assetTypeName !== undefined &&
    data.institutionId !== undefined &&
    data.currency !== undefined;

  if (hasAssetId && hasAnyTickerField) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Informe apenas assetId OU os dados para criar o ativo (ticker, institutionId, assetTypeName, currency) — não os dois",
    });
    return;
  }

  if (!hasAssetId && !hasTickerBundle) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Informe assetId (ativo existente) ou ticker, institutionId, assetTypeName e currency (para criar o ativo)",
    });
  }
}

export const CreateAssetTransactionDto = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("buy"), ...buySellShape, ...identificationShape }).strict(),
    z.object({ type: z.literal("sell"), ...buySellShape, ...identificationShape }).strict(),
    z.object({ type: z.literal("dividend"), ...dividendShape, ...identificationShape }).strict(),
  ])
  .superRefine(checkAssetIdentification);

export const UpdateAssetTransactionDto = z.discriminatedUnion("type", [
  z.object({ type: z.literal("buy"), ...buySellShape }).strict(),
  z.object({ type: z.literal("sell"), ...buySellShape }).strict(),
  z.object({ type: z.literal("dividend"), ...dividendShape }).strict(),
]);

export const AssetTransactionListQueryDto = createPaginationQueryDto(
  ALLOWED_SORT_FIELDS_ASSET_TRANSACTION,
).extend({
  assetId: z.coerce.number().int().positive().optional(),
  type: z.nativeEnum(AssetTransactionType).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type CreateAssetTransactionDtoType = z.infer<typeof CreateAssetTransactionDto>;
export type UpdateAssetTransactionDtoType = z.infer<typeof UpdateAssetTransactionDto>;
