import { z } from "zod";

export const CreateFixedIncomeAssetDto = z
  .object({
    description: z.string().min(2).max(255),
    startDate: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid start date format",
      })
      .transform((date) => new Date(date)),
    maturityDate: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid maturity date format",
      })
      .transform((date) => new Date(date)),
    interestRate: z.number().min(0).max(100),
    investedValueCents: z.number().min(0),
    institutionId: z.number().min(1),
    typeId: z.number().min(1),
    currency: z.string().min(2).max(10),
  })
  .refine((data) => data.maturityDate > data.startDate, {
    message: "Maturity date must be after start date",
    path: ["maturityDate"],
  });

export const UpdateFixedIncomeAssetDto = z
  .object({
    id: z.string().min(1),
    description: z.string().min(2).max(255).optional(),
    startDate: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid start date format",
      })
      .transform((date) => new Date(date))
      .optional(),
    maturityDate: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid maturity date format",
      })
      .transform((date) => new Date(date))
      .optional(),
    interestRate: z.number().min(0).max(100).optional(),
    investedValueCents: z.number().min(0).optional(),
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
  id: z.string().min(1),
});
