import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { LoginDTO, RegisterDTO } from "../dtos/auth.dto";
import { handleZodError } from "../utils/handle-zod-error";

export const register = async (req: Request, res: Response) => {
  const result = RegisterDTO.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const user = await authService.register(result.data);

  res.json(user);
};

export const login = async (req: Request, res: Response) => {
  const result = LoginDTO.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const user = await authService.login(result.data);

  res.json(user);
};
