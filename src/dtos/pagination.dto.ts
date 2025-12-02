import { z } from "zod";

export const PaginationQueryDto = z
  .object({
    page: z.coerce.number().min(1).optional(),
    itemsPerPage: z.coerce.number().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    order: z.enum(["ASC", "DESC"]).optional(),
  })
  .strict();

export type PaginationQueryDtoType = z.infer<typeof PaginationQueryDto>;

export type PaginatedResponseDto<T> = {
  data: T[];
  meta: {
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};
