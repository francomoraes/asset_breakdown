import express from "express";
import { getMyOperationLogs } from "../controllers/operation-log.controller";

const router = express.Router();

router.get("/", getMyOperationLogs);

export default router;
