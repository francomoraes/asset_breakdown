import { z } from "zod";

export const CreateWealthHistoryDto = z
  .object({
    date: z
      .string({ required_error: "A data é obrigatória" })
      .refine((val) => !isNaN(Date.parse(val)), "Data inválida"),
    totalWealthCents: z
      .number({ required_error: "O valor do patrimônio é obrigatório" })
      .int("O patrimônio deve ser um número inteiro")
      .nonnegative("O patrimônio deve ser positivo ou zero"),
  })
  .strict();

export const UpdateWealthHistoryDto = z
  .object({
    date: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), "Data inválida")
      .optional(),
    totalWealthCents: z
      .number()
      .int("O patrimônio deve ser um número inteiro")
      .nonnegative("O patrimônio deve ser positivo ou zero")
      .optional(),
  })
  .strict();
