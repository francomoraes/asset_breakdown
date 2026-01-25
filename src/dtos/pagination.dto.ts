import { ALLOWED_SORT_FIELDS } from "enums/allowedSortFields.enum";
import { ALLOWED_SORT_FIELDS_FIXED_INCOME } from "enums/allowedSortFieldsFIxedIncome.enum";
import { z } from "zod";

export const createPaginationQueryDto = <T extends Record<string, string>>(
  allowedSortFields: T,
) =>
  z
    .object({
      page: z.coerce.number().min(1).optional(),
      itemsPerPage: z.coerce.number().min(1).max(100).optional(),
      sortBy: z.nativeEnum(allowedSortFields).optional(),
      order: z.enum(["ASC", "DESC"]).optional(),
      skipPagination: z.coerce.boolean().optional().default(false),
    })
    .strict();

export const PaginationQueryDto = createPaginationQueryDto(ALLOWED_SORT_FIELDS);

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
