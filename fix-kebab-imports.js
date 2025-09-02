const fs = require("fs");
const path = require("path");

// Mapeamento de nomes antigos para novos
const fileMap = {
  // Controllers
  "asset-class.controller": "asset-class.controller",
  "asset-type.controller": "asset-type.controller",
  "summary.controller": "summary.controller",

  // DTOs
  "asset-class.dto": "asset-class.dto",
  "asset-type.dto": "asset-type.dto",

  // Models
  "asset-class": "asset-class",
  "asset-type": "asset-type",
  "price-cache": "price-cache",

  // Services
  "asset-class.service": "asset-class.service",
  "asset.service": "asset.service",
  "asset-type.service": "asset-type.service",
  "auth.service": "auth.service",
  "summary.service": "summary.service",

  // Utils
  "calculate-derived-fields": "calculate-derived-fields",
  "ensure-data-source": "ensure-data-source",
  "format-yahoo-ticker": "format-yahoo-ticker",
  "get-brl-to-usd-rate": "get-brl-to-usd-rate",
  "get-market-price": "get-market-price",
  "handle-zod-error": "handle-zod-error",
  "recalculate-portfolio": "recalculate-portfolio",

  // Middlewares
  "error-handler": "error-handler",

  // Errors
  "app-error": "app-error",
};

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;

  // Fix imports para arquivos renomeados
  content = content
    .replace(
      /from "\.\.\/controllers\/assetClass\.controller"/g,
      'from "../controllers/asset-class.controller"',
    )
    .replace(
      /from "\.\.\/controllers\/assetType\.controller"/g,
      'from "../controllers/asset-type.controller"',
    )
    .replace(
      /from "\.\.\/controllers\/summaryController"/g,
      'from "../controllers/summary.controller"',
    )
    .replace(
      /from "controllers\/summaryController"/g,
      'from "../controllers/summary.controller"',
    )

    .replace(/from "dtos\/assetClass\.dto"/g, 'from "../dtos/asset-class.dto"')
    .replace(/from "dtos\/assetType\.dto"/g, 'from "../dtos/asset-type.dto"')

    .replace(/from "\.\.\/models\/AssetClass"/g, 'from "../models/asset-class"')
    .replace(/from "\.\.\/models\/AssetType"/g, 'from "../models/asset-type"')
    .replace(/from "\.\.\/models\/PriceCache"/g, 'from "../models/price-cache"')

    .replace(
      /from "\.\.\/services\/assetClassService"/g,
      'from "../services/asset-class.service"',
    )
    .replace(
      /from "\.\.\/services\/assetService"/g,
      'from "../services/asset.service"',
    )
    .replace(
      /from "\.\.\/services\/assetTypeService"/g,
      'from "../services/asset-type.service"',
    )
    .replace(
      /from "\.\.\/services\/authService"/g,
      'from "../services/auth.service"',
    )
    .replace(
      /from "\.\.\/services\/summaryService"/g,
      'from "../services/summary.service"',
    )

    .replace(
      /from "\.\.\/utils\/calculateDerivedFields"/g,
      'from "../utils/calculate-derived-fields"',
    )
    .replace(
      /from "\.\.\/utils\/ensureDataSource"/g,
      'from "../utils/ensure-data-source"',
    )
    .replace(
      /from "\.\.\/utils\/formatYahooTicker"/g,
      'from "../utils/format-yahoo-ticker"',
    )
    .replace(
      /from "\.\.\/utils\/getBRLtoUSDRate"/g,
      'from "../utils/get-brl-to-usd-rate"',
    )
    .replace(
      /from "\.\.\/utils\/getMarketPrice"/g,
      'from "../utils/get-market-price"',
    )
    .replace(
      /from "\.\.\/utils\/handleZodError"/g,
      'from "../utils/handle-zod-error"',
    )
    .replace(
      /from "\.\.\/utils\/recalculatePortfolio"/g,
      'from "../utils/recalculate-portfolio"',
    )

    .replace(
      /from "\.\.\/middlewares\/errorHandler"/g,
      'from "../middlewares/error-handler"',
    )
    .replace(/from "\.\.\/errors\/AppError"/g, 'from "../errors/app-error"');

  if (content !== fs.readFileSync(filePath, "utf8")) {
    changed = true;
  }

  fs.writeFileSync(filePath, content);
  return changed;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith(".ts")) {
      const changed = fixImportsInFile(fullPath);
      if (changed) {
        console.log(`Updated imports in: ${fullPath}`);
      }
    }
  });
}

console.log("🔧 Corrigindo imports após renomeação...");
walkDir("./src");
console.log("✅ Imports atualizados!");
