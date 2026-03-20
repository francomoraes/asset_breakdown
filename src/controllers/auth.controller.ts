import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { LoginDTO, RegisterDTO, UpdateUserDto } from "../dtos/auth.dto";
import { handleZodError } from "../utils/handle-zod-error";
import { getAuthenticatedUserId } from "utils/get-authenticated-user-id";
import { storageAdapter } from "config/storage";

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

export const uploadProfilePicture = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);

  const file = req.file;

  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const fileUrl = await storageAdapter.upload(file, userId);

  res.json({ profilePictureUrl: fileUrl });
};

export const updateUser = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    res.status(400).json({ message: "User ID is required" });
    return;
  }

  const result = UpdateUserDto.safeParse(req.body);

  if (!result.success) {
    return handleZodError(res, result.error);
  }

  if (req.user?.userId !== Number(userId)) {
    res
      .status(403)
      .json({ message: "Forbidden: You can only update your own account" });
    return;
  }

  const updatedUser = await authService.updateUser({
    id: userId,
    ...result.data,
  });

  res.json(updatedUser);
};
