import express from "express";
import multer from "multer";

import { uploadCsv } from "../controllers/csv.controller";
import path from "path";

const upload = multer({ dest: "src/uploads/" });
const router = express.Router();

router.get("/csv-template", (_req, res) => {
  const filePath = path.join(__dirname, "..", "static", "asset-template.csv");
  res.download(filePath, "modelo-carteira.csv");
});

router.post("/upload-csv", upload.single("file"), uploadCsv);

export default router;
