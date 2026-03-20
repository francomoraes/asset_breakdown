import { z } from "zod";

export const UpdateAssetDto = z
  .object({
    id: z
      .string({ required_error: "O ID do ativo é obrigatório" })
      .regex(/^\d+$/, "O ID do ativo deve ser um número inteiro"),
    type: z.string().optional(),
    ticker: z.string().optional(),
    quantity: z
      .number({ invalid_type_error: "A quantidade deve ser um número" })
      .positive("A quantidade deve ser maior que zero")
      .optional(),
    averagePriceCents: z
      .number({
        invalid_type_error: "O preço médio em centavos deve ser um número",
      })
      .int("O preço médio deve ser um número inteiro")
      .nonnegative("O preço médio deve ser positivo")
      .optional(),
    institutionId: z.number().int().positive().optional(),
    currency: z.string().optional(),
  })
  .strict();

export const CreateAssetDto = z
  .object({
    ticker: z
      .string({ required_error: "O ticker é obrigatório" })
      .min(1, "O ticker deve ter pelo menos 1 caractere")
      .transform((val) => val.toUpperCase()),
    quantity: z
      .number({ required_error: "A quantidade é obrigatória" })
      .positive("A quantidade deve ser maior que zero"),
    averagePriceCents: z
      .number({ required_error: "O preço médio em centavos é obrigatório" })
      .int("O preço médio deve ser um número inteiro")
      .nonnegative("O preço médio deve ser positivo"),
    type: z.string({ required_error: "O tipo de ativo é obrigatório" }),
    institutionId: z
      .number({ required_error: "A instituição é obrigatória" })
      .int()
      .positive(),
    currency: z
      .string({ required_error: "A moeda é obrigatória" })
      .refine((val) => ["BRL", "USD"].includes(val), {
        message: "A moeda deve ser BRL ou USD",
      }),
  })
  .strict();

export const DeleteAssetDto = z
  .object({
    id: z
      .string({ required_error: "O ID do ativo é obrigatório" })
      .regex(/^\d+$/, "O ID do ativo deve ser um número inteiro"),
  })
  .strict();
