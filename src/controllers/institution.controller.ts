import {
  CreateInstitutionDto,
  DeleteInstitutionDto,
  UpdateInstitutionDto,
} from "../dtos/institution.dto";

import { Request, Response } from "express";
import { institutionService } from "../services/institution.service";
import { handleZodError } from "../utils/handle-zod-error";
import { getAuthenticatedUserId } from "../utils/get-authenticated-user-id";

export const createInstitution = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const result = CreateInstitutionDto.safeParse({
    name: req.body.name,
  });

  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { name } = result.data;

  const institution = await institutionService.createInstitution({
    userId,
    name,
  });
  res.status(201).json({
    message: "Institution created successfully",
    institution,
  });
};

export const getInstitutions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const institutions = await institutionService.getInstitutions({ userId });

  res.json(institutions);
};

export const getInstitutionById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const { id } = req.params;

  const institution = await institutionService.getInstitutionById({
    id,
    userId,
  });

  res.json(institution);
};

export const updateInstitution = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const dtoData = {
    id: req.params.id,
    name: req.body.name,
  };

  const result = UpdateInstitutionDto.safeParse(dtoData);

  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { id, name } = result.data;

  const institution = await institutionService.updateInstitution({
    id,
    userId,
    name,
  });

  res.json({ message: "Institution updated successfully", institution });
};

export const deleteInstitution = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getAuthenticatedUserId(req);

  const parsedParams = DeleteInstitutionDto.safeParse({
    id: req.params.id,
  });

  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const { id } = parsedParams.data;

  const institution = await institutionService.deleteInstitution({
    id,
    userId,
  });

  res.json({
    message: `Institution ${institution.name} deleted successfully`,
  });
};
