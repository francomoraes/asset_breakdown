import express from "express";
import multer from "multer";

import { uploadCsv } from "../controllers/csv.controller";
import { fileURLToPath } from "url";
import path from "path";

const upload = multer({ dest: "src/uploads/" });
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get("/csv-template", (req, res) => {
  const filePath = path.join(__dirname, "..", "static", "asset-template.csv");
  res.download(filePath, "modelo-carteira.csv");
});

router.post("/upload-csv", upload.single("file"), uploadCsv);

export default router;
