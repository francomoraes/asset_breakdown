import { z } from "zod";

export const assetClassCreateSchema = z.object({
  name: z.string().min(1),
});

export const assetClassIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/),
});
