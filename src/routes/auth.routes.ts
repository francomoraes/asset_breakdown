import {
  login,
  logout,
  refresh,
  register,
  updateUser,
  uploadProfilePicture,
} from "../controllers/auth.controller";
import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { authLimiter } from "../middlewares/rate-limit";
import {
  uploadProfilePicture as uploadMiddleware,
  validateImageBytes,
} from "../middlewares/upload.middleware";

const router = express.Router();

router.post("/register", register);
router.post("/login", authLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post(
  "/upload-profile-picture",
  authMiddleware,
  uploadMiddleware,
  validateImageBytes,
  uploadProfilePicture,
);
router.put("/users/:id", authMiddleware, updateUser);

export default router;
