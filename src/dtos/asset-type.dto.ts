import { z } from "zod";

export const CreateAssetTypeDto = z.object({
  name: z.string().min(2).max(100),
  targetPercentage: z.number().min(0).max(100),
  assetClassId: z.number(),
});

export const UpdateAssetTypeDto = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(100).optional(),
  targetPercentage: z.number().min(0).max(100).optional(),
  assetClassId: z.number().optional(),
});

export const DeleteAssetTypeDto = z.object({
  id: z.string().min(1),
});
