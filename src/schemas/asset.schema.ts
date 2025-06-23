import { z } from "zod";

export const buyAssetSchema = z.object({
  quantity: z
    .number({ required_error: "A quantidade é obrigatória" })
    .positive("A quantidade deve ser maior que zero"),

  priceCents: z
    .number({ required_error: "O preço em centavos é obrigatório" })
    .int("O preço deve ser um número inteiro")
    .nonnegative("O preço deve ser positivo"),

  type: z.string().optional(),
  institution: z.string().optional(),
  currency: z.string().optional(),
});

export const updateAssetSchema = z.object({
  type: z.string({ required_error: "O tipo é obrigatório" }),
  ticker: z.string({ required_error: "O ticker é obrigatório" }),
  quantity: z
    .number({ required_error: "A quantidade é obrigatória" })
    .positive("A quantidade deve ser maior que zero"),
  averagePriceCents: z
    .number({ required_error: "O preço médio em centavos é obrigatório" })
    .int("O preço médio deve ser um número inteiro")
    .nonnegative("O preço médio deve ser positivo"),
  institution: z.string({ required_error: "A instituição é obrigatória" }),
  currency: z.string({ required_error: "A moeda é obrigatória" }),
});

export const assetIdParamsSchema = z.object({
  id: z
    .string({ required_error: "O ID do ativo é obrigatório" })
    .regex(/^\d+$/, "O ID do ativo deve ser um número inteiro"),
});

export const csvAssetSchema = z.object({
  type: z.string().nonempty("O campo 'type' é obrigatório"),
  ticker: z.string().nonempty("O campo 'ticker' é obrigatório"),
  quantity: z.string().regex(/^\d+(\.\d+)?$/, "Quantidade deve ser um número"),
  averagePrice: z
    .string()
    .regex(/^\d+(,\d{1,2})?$/, "Preço médio deve estar no formato 1000,00"),
  institution: z.string().nonempty("O campo 'institution' é obrigatório"),
  currency: z.string().nonempty("O campo 'currency' é obrigatório"),
});

export const sellAssetSchema = z.object({
  quantity: z
    .number({ invalid_type_error: "A quantidade deve ser um número" })
    .positive("A quantidade deve ser maior que zero"),
  priceCents: z
    .number({ invalid_type_error: "O preço em centavos deve ser um número" })
    .int("O preço deve ser um número inteiro")
    .nonnegative("O preço deve ser positivo"),
});

export const tickerParamsSchema = z.object({
  ticker: z
    .string({ required_error: "O ticker é obrigatório" })
    .min(3, "O ticker deve ter pelo menos 3 caracteres"),
});

export const userIdParamsSchema = z.object({
  userId: z.string().min(1, "O ID do usuário é obrigatório"),
});
