import { z } from "zod";

export const CreateAssetClassDto = z
  .object({
    name: z.string().min(1),
    userId: z.string().min(1),
  })
  .strict();
export type CreateAssetClassDtoType = z.infer<typeof CreateAssetClassDto>;

export const UpdateAssetClassDto = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    userId: z.string().min(1),
  })
  .strict();
export type UpdateAssetClassDtoType = z.infer<typeof UpdateAssetClassDto>;

export const DeleteAssetClassDto = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
  })
  .strict();
export type DeleteAssetClassDtoType = z.infer<typeof DeleteAssetClassDto>;
