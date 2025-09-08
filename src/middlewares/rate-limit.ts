import { config } from "../config/environment";
import { rateLimit } from "express-rate-limit";

const demoLimits = {
  general: { windowMs: 15 * 60 * 1000, max: 50 },
  auth: { windowMs: 5 * 60 * 1000, max: 3 },
  upload: { windowMs: 60 * 60 * 1000, max: 2 },
};

const prodLimits = {
  general: { windowMs: 15 * 60 * 1000, max: 100 },
  auth: { windowMs: 5 * 60 * 1000, max: 5 },
  upload: { windowMs: 60 * 60 * 1000, max: 5 },
};

const limits = config.isDemo ? demoLimits : prodLimits;

const appLimiter = rateLimit({
  windowMs: limits.general.windowMs, // 15 minutes
  max: limits.general.max, // limit each IP to 100 requests per windowMs
  message: {
    error: config.isDemo
      ? "Demo API: Rate limit exceeded. This is a demonstration environment."
      : "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
});

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: "Too many login attempts from this IP, please try again later.",
    retryAfter: "5 minutes",
  },
});

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "1 hour",
  },
});

export { appLimiter, authLimiter, strictLimiter };
