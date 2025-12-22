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

export const updateUser = async (req: Request, res: Response) => {
  const userId = req.params.id;
  const updateData = req.body;

  if (!userId) {
    res.status(400).json({ message: "User ID is required" });
    return;
  }

  if (req.user?.userId !== Number(userId)) {
    res
      .status(403)
      .json({ message: "Forbidden: You can only update your own account" });
    return;
  }

  const updatedUser = await authService.updateUser({
    id: Number(userId),
    ...updateData,
  });

  res.json(updatedUser);
};
