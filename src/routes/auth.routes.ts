import {
  login,
  register,
  updateUser,
  uploadProfilePicture,
} from "../controllers/auth.controller";
import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { uploadProfilePicture as uploadMiddleware } from "../middlewares/upload.middleware";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post(
  "/upload-profile-picture",
  authMiddleware,
  uploadMiddleware,
  uploadProfilePicture,
);
router.put("/users/:id", authMiddleware, updateUser);

export default router;
