import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = Date.now();

  next();

  const duration = Date.now() - start;
  logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
};
