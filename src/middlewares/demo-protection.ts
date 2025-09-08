// src/middlewares/demo-protection.ts
import { Request, Response, NextFunction } from "express";
import { config } from "../config/environment";

export const demoProtection = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!config.isDemo) {
    return next();
  }

  const dangerousOperations = [
    "DELETE",
    req.path.includes("/upload-csv") && req.method === "POST",
  ];

  if (dangerousOperations.some((op) => op === req.method)) {
    throw new Error("Operation not allowed in demo mode");
  }

  if (req.path === "/api/auth/register" && req.method === "POST") {
    const allowedDomains = ["example.com", "test.com", "demo.com"];
    const email = req.body?.email;

    if (
      email &&
      !allowedDomains.some((domain) => email.endsWith(`@${domain}`))
    ) {
      throw new Error("Demo registration restricted");
    }
  }

  next();
};
