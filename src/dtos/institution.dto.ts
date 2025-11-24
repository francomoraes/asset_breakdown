import { z } from "zod";

export const CreateInstitutionDto = z
  .object({
    name: z.string().min(1),
  })
  .strict();
export type CreateInstitutionDtoType = z.infer<typeof CreateInstitutionDto>;

export const UpdateInstitutionDto = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();
export type UpdateInstitutionDtoType = z.infer<typeof UpdateInstitutionDto>;

export const DeleteInstitutionDto = z
  .object({
    id: z.string().min(1),
  })
  .strict();

export type DeleteInstitutionDtoType = z.infer<typeof DeleteInstitutionDto>;
