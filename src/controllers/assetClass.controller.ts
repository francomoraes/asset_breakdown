import {
  CreateAssetClassDto,
  DeleteAssetClassDto,
  UpdateAssetClassDto,
} from "../dtos/assetClass.dto";
import { UserIdParamDto } from "../dtos/params.dto";
import { Request, Response } from "express";
import { assetClassService } from "../services/assetClassService";
import { handleZodError } from "../utils/handleZodError";

export const createAssetClass = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const dtoData = {
    name: req.body.name,
    userId: req.params.userId,
  };
  const result = CreateAssetClassDto.safeParse(dtoData);

  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { userId, name } = result.data;

  const assetClass = await assetClassService.createAssetClass({
    userId,
    name,
  });
  res.status(201).json({
    message: "Asset class created successfully",
    assetClass,
  });
};

export const getAssetClasses = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const paramsCheck = UserIdParamDto.safeParse(req.params);

  if (!paramsCheck.success) {
    return handleZodError(res, paramsCheck.error);
  }

  const { userId } = paramsCheck.data;

  const assetClasses = await assetClassService.getAssetClasses({ userId });

  res.json(assetClasses);
};

export const updateAssetClass = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const dtoData = {
    id: req.params.id,
    userId: req.params.userId,
    name: req.body.name,
  };

  const result = UpdateAssetClassDto.safeParse(dtoData);

  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { id, userId, name } = result.data;

  const assetClass = await assetClassService.updateAssetClass({
    id,
    userId,
    name,
  });

  res.json({ message: "Asset class updated successfully", assetClass });
};

export const deleteAssetClass = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const dtoData = {
    id: req.params.id,
    userId: req.params.userId,
  };

  const parsedParams = DeleteAssetClassDto.safeParse(dtoData);

  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const { id, userId } = parsedParams.data;

  const assetClass = await assetClassService.deleteAssetClass({
    id,
    userId,
  });

  res.json({
    message: `Asset class ${assetClass.name} deleted successfully`,
  });
};
