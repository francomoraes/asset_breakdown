import { z } from "zod";

export const csvAssetSchema = z.object({
  type: z.string().min(2).max(100),
  ticker: z.string().min(2).max(10),
  quantity: z.string().min(1).max(20),
  averagePrice: z.string().min(1).max(20),
  institutionName: z.string().min(2).max(100),
  currency: z.string().min(3).max(3),
});
