import dotenv from "dotenv";

const envFile = `.env.${process.env.NODE_ENV || "development"}`;
dotenv.config({ path: envFile });

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  exchangeRateTtlHours: Number(process.env.EXCHANGE_RATE_TTL_HOURS || 4),
  marketPriceTtlHours: Number(process.env.MARKET_PRICE_TTL_HOURS || 4),
  marketIndicesTtlHours: Number(process.env.MARKET_INDICES_TTL_HOURS || 24),
  rateLimitWindowMs: Number(process.env.RL_WINDOW_MS || 10 * 60 * 1000),
  rateLimitLow: Number(process.env.RL_LIMIT_LOW || 5),
  rateLimitMedium: Number(process.env.RL_LIMIT_MEDIUM || 20),
  rateLimitHigh: Number(process.env.RL_LIMIT_HIGH || 30),
  yahooMaxConcurrency: Number(process.env.YAHOO_MAX_CONCURRENCY || 2),

  isDevelopment: process.env.NODE_ENV === "development",
  isDemo: process.env.NODE_ENV === "demo",
  isProduction: process.env.NODE_ENV === "production",

  logLevel:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "development" ? "debug" : "info"),
};
