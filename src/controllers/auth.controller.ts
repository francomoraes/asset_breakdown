import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { LoginDTO, RegisterDTO, UpdateUserDto } from "../dtos/auth.dto";
import { handleZodError } from "../utils/handle-zod-error";
import { getAuthenticatedUserId } from "utils/get-authenticated-user-id";
import { storageAdapter } from "config/storage";
import { config } from "config/environment";

// In production, frontend (Vercel) and backend (Railway) are different sites,
// so SameSite must be "none" (with Secure) for the cookie to be sent cross-site.
// In development, both run on localhost so "strict" is fine and avoids the Secure requirement.
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: (config.isProduction ? "none" : "strict") as "none" | "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/api/auth",
};

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie("refresh_token", refreshToken, REFRESH_COOKIE_OPTIONS);
}

function clearRefreshCookie(res: Response) {
  res.clearCookie("refresh_token", {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? "none" : "strict",
    path: "/api/auth",
  });
}

export const register = async (req: Request, res: Response) => {
  const result = RegisterDTO.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { user, token, refreshToken } = await authService.register(result.data);

  setRefreshCookie(res, refreshToken);
  res.json({ user, token });
};

export const login = async (req: Request, res: Response) => {
  const result = LoginDTO.safeParse(req.body);
  if (!result.success) {
    return handleZodError(res, result.error);
  }

  const { user, token, refreshToken } = await authService.login(result.data);

  console.log({ user });

  setRefreshCookie(res, refreshToken);
  res.json({ user, token });
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) {
    res.status(401).json({ message: "No refresh token" });
    return;
  }

  const {
    user,
    token,
    refreshToken: newRefreshToken,
  } = await authService.refreshSession(refreshToken);

  setRefreshCookie(res, newRefreshToken);
  res.json({ user, token });
};

export const logout = (_req: Request, res: Response) => {
  clearRefreshCookie(res);
  res.json({ message: "Logged out" });
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

  const { user, token, refreshToken } = await authService.updateUser({
    id: userId,
    ...result.data,
  });

  setRefreshCookie(res, refreshToken);
  res.json({ user, token });
};
