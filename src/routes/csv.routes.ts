import express from "express";
import multer from "multer";

import { uploadCsv } from "../controllers/csv.controller";
import path from "path";

const upload = multer({ dest: "src/uploads/" });
const router = express.Router();

router.get("/csv-template", (_req, res) => {
  const csvContent =
    "type,ticker,quantity,averagePrice,institution,currency\n" +
    "Stock,AAPL,10,150.00,XP,USD\n";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=modelo-carteira.csv",
  );
  res.send(csvContent);
});

router.post("/upload-csv", upload.single("file"), uploadCsv);

export default router;
