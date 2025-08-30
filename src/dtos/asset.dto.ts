import { z } from "zod";

export const UpdateAssetDto = z
  .object({
    id: z
      .string({ required_error: "O ID do ativo é obrigatório" })
      .regex(/^\d+$/, "O ID do ativo deve ser um número inteiro"),
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
  })
  .strict();

export const BuyAssetDto = z
  .object({
    ticker: z
      .string({ required_error: "O ticker é obrigatório" })
      .min(3, "O ticker deve ter pelo menos 3 caracteres"),
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
  })
  .strict();

export const SellAssetDto = z
  .object({
    ticker: z
      .string({ required_error: "O ticker é obrigatório" })
      .min(3, "O ticker deve ter pelo menos 3 caracteres"),
    quantity: z
      .number({ invalid_type_error: "A quantidade deve ser um número" })
      .positive("A quantidade deve ser maior que zero"),
    priceCents: z
      .number({ invalid_type_error: "O preço em centavos deve ser um número" })
      .int("O preço deve ser um número inteiro")
      .nonnegative("O preço deve ser positivo"),
  })
  .strict();
