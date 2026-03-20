import {
  CreateFixedIncomeAssetDto,
  DeleteFixedIncomeAssetDto,
  UpdateFixedIncomeAssetDto,
} from "dtos/fixed-income-asset.dto";
import { createPaginationQueryDto } from "dtos/pagination.dto";
import { ALLOWED_SORT_FIELDS_FIXED_INCOME } from "enums/allowedSortFieldsFIxedIncome.enum";
import { Request, Response } from "express";
import { fixedIncomeAssetService } from "services/fixed-income-asset.service";
import { getAuthenticatedUserId } from "utils/get-authenticated-user-id";
import { handleZodError } from "utils/handle-zod-error";

export const getFixedIncomeAssetsByUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const PaginationQueryDto = createPaginationQueryDto(
    ALLOWED_SORT_FIELDS_FIXED_INCOME,
  );

  const paginationParams = PaginationQueryDto.safeParse(req.query);

  if (!paginationParams.success) {
    return handleZodError(res, paginationParams.error, 409);
  }

  const assets = await fixedIncomeAssetService.getAssetsByUser({
    userId,
    ...paginationParams.data,
    currentPage: paginationParams.data.page ?? 1,
  } as Parameters<typeof fixedIncomeAssetService.getAssetsByUser>[0]);

  res.json(assets);
};

export const createFixedIncomeAsset = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const result = CreateFixedIncomeAssetDto.safeParse(req.body);

  if (!result.success) return handleZodError(res, result.error, 409);

  const asset = await fixedIncomeAssetService.createAsset({
    ...result.data,
    userId,
  });

  res.status(201).json({
    message: "Fixed income asset created successfully",
    asset,
  });
};

export const updateFixedIncomeAsset = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const result = UpdateFixedIncomeAssetDto.safeParse({
    ...req.body,
    id: req.params.id,
  });

  if (!result.success) return handleZodError(res, result.error, 409);

  const asset = await fixedIncomeAssetService.updateAsset({
    ...result.data,
    id: Number(result.data.id),
    userId,
  });

  res.json({
    message: `Fixed income asset ${result.data.description} updated successfully`,
    asset,
  });
};

export const deleteFixedIncomeAsset = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const result = DeleteFixedIncomeAssetDto.safeParse({
    id: req.params.id,
  });

  if (!result.success) return handleZodError(res, result.error, 409);

  await fixedIncomeAssetService.deleteAsset({
    id: Number(result.data.id),
    userId,
  });

  res.json({
    message: `Fixed income asset ${result.data.id} deleted successfully`,
  });
};
