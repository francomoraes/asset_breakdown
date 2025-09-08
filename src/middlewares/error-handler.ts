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

  const sanitizeBody = (body: any) => {
    if (!body || typeof body !== "object") return body;

    const sanitized = { ...body };
    const sensitiveFields = [
      "password",
      "confirmPassword",
      "currentPassword",
      "newPassword",
      "token",
      "accessToken",
      "refreshToken",
      "apiKey",
      "secret",
      "authorization",
      "creditCard",
      "ssn",
      "cpf",
    ];

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    });

    return sanitized;
  };

  // Log adicional com contexto da requisição
  logger.error("Request details", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    body: sanitizeBody(req.body),
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
