import { Response } from "express";

export const handleZodError = (res: Response, parsed: any, message: string) => {
  res.status(400).json({
    error: message,
    issues: parsed.error.format(),
  });
  return;
};
