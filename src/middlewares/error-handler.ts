import { Request, Response, NextFunction } from "express";
import { logger, logError } from "../utils/logger";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Log estruturado do erro
  logError(err, `${req.method} ${req.path}`);

  // Log adicional com contexto da requisição
  logger.error("Request details", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Resposta para o cliente (sem stack trace em produção)
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(500).json({
    error: "Internal server error",
    ...(isDevelopment && { stack: err.stack, message: err.message }),
  });
};
