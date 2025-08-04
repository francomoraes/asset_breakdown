import { z } from "zod";

export const UserIdParamDto = z
  .object({
    userId: z.string().min(1),
  })
  .strict();
export type UserIdParamDtoType = z.infer<typeof UserIdParamDto>;
