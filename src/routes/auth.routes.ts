import { login, register, updateUser } from "../controllers/auth.controller";
import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.put("/users/:id", authMiddleware, updateUser);

export default router;
