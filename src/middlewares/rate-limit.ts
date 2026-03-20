import { config } from "../config/environment";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { Request } from "express";

const demoLimits = {
  general: { windowMs: 15 * 60 * 1000, max: 50 },
  auth: { windowMs: 5 * 60 * 1000, max: 3 },
  upload: { windowMs: 60 * 60 * 1000, max: 2 },
};

const prodLimits = {
  general: { windowMs: 15 * 60 * 1000, max: 100 },
  auth: { windowMs: 5 * 60 * 1000, max: 10 },
  upload: { windowMs: 60 * 60 * 1000, max: 5 },
};

const devLimits = {
  general: { windowMs: 15 * 60 * 1000, max: 10000 },
  auth: { windowMs: 5 * 60 * 1000, max: 1000 },
  upload: { windowMs: 60 * 60 * 1000, max: 1000 },
};

const limits = config.isDevelopment
  ? devLimits
  : config.isDemo
    ? demoLimits
    : prodLimits;

const appLimiter = rateLimit({
  windowMs: limits.general.windowMs,
  max: limits.general.max,
  skip: () => config.isDevelopment,
  message: {
    error: config.isDemo
      ? "Demo API: Rate limit exceeded. This is a demonstration environment."
      : "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
});

const authLimiter = rateLimit({
  windowMs: limits.auth.windowMs,
  max: limits.auth.max,
  skip: () => config.isDevelopment,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts from this IP, please try again later.",
    retryAfter: "5 minutes",
  },
});

const strictLimiter = rateLimit({
  windowMs: limits.upload.windowMs,
  max: limits.upload.max,
  skip: () => config.isDevelopment,
  message: {
    error: "Too many uploads from this IP, please try again later.",
    retryAfter: "1 hour",
  },
});

const heavyWindowMs = config.rateLimitWindowMs;

const getKey = (req: Request) => {
  if (req.user?.userId) {
    return `user:${req.user.userId}`;
  }

  return `ip:${ipKeyGenerator(req.ip || "")}`;
};

const createHeavyLimiter = (scope: "low" | "medium" | "high", max: number) =>
  rateLimit({
    windowMs: heavyWindowMs,
    max,
    skip: () => config.isDevelopment,
    keyGenerator: getKey,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests for this endpoint. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
      scope,
      retryAfterSeconds: Math.ceil(heavyWindowMs / 1000),
    },
  });

const refreshLimiter = createHeavyLimiter("low", config.rateLimitLow);
const marketIndicesLimiter = createHeavyLimiter(
  "medium",
  config.rateLimitMedium,
);
const summaryLimiter = createHeavyLimiter("high", config.rateLimitHigh);

export {
  appLimiter,
  authLimiter,
  strictLimiter,
  refreshLimiter,
  marketIndicesLimiter,
  summaryLimiter,
};
