import {
  CreateInstitutionDto,
  DeleteInstitutionDto,
  UpdateInstitutionDto,
} from "../dtos/institution.dto";

import { Request, Response } from "express";
import { institutionService } from "../services/institution.service";
import { handleZodError } from "../utils/handle-zod-error";
import { getEffectiveUserId } from "../utils/get-effective-user-id";
import { getAuthenticatedUserId } from "../utils/get-authenticated-user-id";

export const createInstitution = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const actorUserId = getAuthenticatedUserId(req);
  const actorEmail = req.user!.email;
  const actorRole = req.user!.role;

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
    actorUserId,
    actorEmail,
    actorRole,
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
  const userId = getEffectiveUserId(req);

  const institutions = await institutionService.getInstitutions({ userId });

  res.json(institutions);
};

export const getInstitutionById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getEffectiveUserId(req);
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
  const userId = getEffectiveUserId(req);
  const actorUserId = getAuthenticatedUserId(req);
  const actorEmail = req.user!.email;
  const actorRole = req.user!.role;

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
    actorUserId,
    actorEmail,
    actorRole,
  });

  res.json({ message: "Institution updated successfully", institution });
};

export const deleteInstitution = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = getEffectiveUserId(req);
  const actorUserId = getAuthenticatedUserId(req);
  const actorEmail = req.user!.email;
  const actorRole = req.user!.role;

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
    actorUserId,
    actorEmail,
    actorRole,
  });

  res.json({
    message: `Institution ${institution.name} deleted successfully`,
  });
};
