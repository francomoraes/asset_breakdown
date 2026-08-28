import { z } from "zod";

// Só a variante mercado_bitcoin por enquanto — quando a Fase 2 (Ethereum) for
// implementada, isto vira um discriminated union com a variante ethereum_wallet.
export const CreateCryptoAccountDto = z
  .object({
    type: z.literal("mercado_bitcoin", {
      required_error: "Tipo de conta é obrigatório",
      invalid_type_error: "Tipo de conta inválido",
    }),
    label: z.string().max(100).optional(),
    institutionId: z
      .number({ required_error: "Instituição é obrigatória" })
      .int()
      .positive(),
    assetType: z
      .string({ required_error: "Tipo de ativo é obrigatório" })
      .min(1),
    apiKey: z.string({ required_error: "API key é obrigatória" }).min(1),
    apiSecret: z.string({ required_error: "API secret é obrigatória" }).min(1),
  })
  .strict();

export const DeleteCryptoAccountDto = z
  .object({
    id: z.string().regex(/^\d+$/, "Id inválido"),
  })
  .strict();

export const SyncCryptoAccountDto = z
  .object({
    id: z.string().regex(/^\d+$/, "Id inválido"),
  })
  .strict();
