import { z } from "zod";

export const updateAssetTypeSchema = z.object({
  name: z.string().min(1).optional(),
  targetPercentage: z.number().min(0).max(1).optional(),
});

export const assetTypeIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/),
});
