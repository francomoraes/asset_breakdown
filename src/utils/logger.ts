import winston from "winston";
import path from "path";

const isDevelopment = process.env.NODE_ENV === "development";

// Formato customizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${
      stack ? "\n" + stack : ""
    }`;
  }),
);

// Formato JSON para produção
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: isDevelopment ? "debug" : "info",
  format: isDevelopment ? logFormat : jsonFormat,

  transports: [
    // Console (sempre)
    new winston.transports.Console({
      format: isDevelopment
        ? winston.format.combine(winston.format.colorize(), logFormat)
        : jsonFormat,
    }),

    // Arquivo para todos os logs
    new winston.transports.File({
      filename: path.join("logs", "combined.log"),
      level: "info",
    }),

    // Arquivo apenas para errors
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
    }),
  ],

  // Para evitar crash em caso de erro no logging
  exitOnError: false,
});

// Função helper para logs de request
export const logRequest = (
  method: string,
  url: string,
  statusCode: number,
  responseTime: number,
  userId?: number,
) => {
  const userInfo = userId ? ` - User ID: ${userId}` : "";
  logger.info(
    `${method} ${url} - ${statusCode} - ${responseTime}ms${userInfo}`,
  );
};

// Função helper para logs de erro
export const logError = (error: Error, context?: string) => {
  const contextInfo = context ? ` [${context}]` : "";
  logger.error(`${error.message}${contextInfo}`, { stack: error.stack });
};
