import express from "express";
import multer from "multer";

import { uploadCsv } from "../controllers/csv.controller";

const upload = multer({ dest: "src/uploads/" });
const router = express.Router();

router.get("/csv-template", (_req, res) => {
  const csvContent =
    "type,ticker,quantity,averagePrice,institutionName,currency\n" +
    "Stocks,AAPL,10,150.50,Avenue,USD\n" +
    "Bitcoin,BTC-USD,0.5,45000.00,Binance,USD\n" +
    "FIIs,TRXF11,100,97.62,XP Investimentos,BRL\n" +
    "Reits,VNQ,20,83.64,Avenue,USD\n" +
    "Inflação,B5P211,150,88.66,XP Investimentos,BRL\n";

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=modelo-carteira.csv",
  );
  res.send(csvContent);
});

router.post("/upload-csv", upload.single("file"), uploadCsv);

export default router;
