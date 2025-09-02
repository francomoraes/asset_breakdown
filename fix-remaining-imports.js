const fs = require("fs");
const path = require("path");

function fixRemainingImports(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      fixRemainingImports(fullPath);
    } else if (file.endsWith(".ts")) {
      let content = fs.readFileSync(fullPath, "utf8");

      // Fix imports que o script anterior não pegou
      content = content
        // Imports sem ../
        .replace(/from "\.\/errorHandler"/g, 'from "./error-handler"')
        .replace(/from "\.\/AssetType"/g, 'from "./asset-type"')
        .replace(/from "\.\/AssetClass"/g, 'from "./asset-class"')
        .replace(/from "\.\/AppError"/g, 'from "./app-error"')
        .replace(
          /from "\.\/formatYahooTicker"/g,
          'from "./format-yahoo-ticker"',
        )
        .replace(/from "\.\/getBRLtoUSDRate"/g, 'from "./get-brl-to-usd-rate"')

        // Imports com ../
        .replace(
          /from "\.\.\/dtos\/assetClass\.dto"/g,
          'from "../dtos/asset-class.dto"',
        )
        .replace(
          /from "\.\.\/dtos\/assetType\.dto"/g,
          'from "../dtos/asset-type.dto"',
        );

      fs.writeFileSync(fullPath, content);
      console.log(`Fixed: ${fullPath}`);
    }
  });
}

console.log("🔧 Corrigindo imports restantes...");
fixRemainingImports("./src");
console.log("✅ Todos os imports corrigidos!");
