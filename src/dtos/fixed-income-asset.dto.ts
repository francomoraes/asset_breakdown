import { z } from "zod";
import { IndexationMode } from "models/fixed-income-asset";

const parseDateOnly = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

export const CreateFixedIncomeAssetDto = z
  .object({
    description: z.string().min(2).max(255),
    manualMode: z.boolean().optional().default(false),
    startDate: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid start date format",
      })
      .transform((date) => parseDateOnly(date))
      .optional(),
    maturityDate: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid maturity date format",
      })
      .transform((date) => parseDateOnly(date))
      .optional(),
    indexationMode: z
      .nativeEnum(IndexationMode)
      .optional()
      .default(IndexationMode.PRE_FIXED),
    interestRate: z.number().min(0).max(100).optional(),
    investedValueCents: z.number().min(0),
    currentValueCents: z.number().min(0).optional(),
    institutionId: z.number().min(1),
    typeId: z.number().min(1),
    currency: z.string().min(2).max(10),
  })
  .refine(
    (data) => {
      if (data.maturityDate && data.startDate) {
        return data.maturityDate > data.startDate;
      }
      return true;
    },
    {
      message: "Maturity date must be after start date",
      path: ["maturityDate"],
    },
  );

export const UpdateFixedIncomeAssetDto = z
  .object({
    id: z.coerce.string().min(1),
    description: z.string().min(2).max(255).optional(),
    manualMode: z.boolean().optional(),
    startDate: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid start date format",
      })
      .transform((date) => parseDateOnly(date))
      .optional(),
    maturityDate: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid maturity date format",
      })
      .transform((date) => parseDateOnly(date))
      .optional(),
    indexationMode: z.nativeEnum(IndexationMode).optional(),
    interestRate: z.number().min(0).max(100).optional(),
    investedValueCents: z.number().min(0).optional(),
    currentValueCents: z.number().min(0).optional(),
    institutionId: z.number().min(1).optional(),
    typeId: z.number().min(1).optional(),
    currency: z.string().min(2).max(10).optional(),
  })
  .refine(
    (data) => {
      if (data.maturityDate && data.startDate) {
        return data.maturityDate > data.startDate;
      }
      return true;
    },
    {
      message: "Maturity date must be after start date",
      path: ["maturityDate"],
    },
  );

export const DeleteFixedIncomeAssetDto = z.object({
  id: z.coerce.string().min(1),
});
