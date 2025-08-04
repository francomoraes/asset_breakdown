import { Response } from "express";

export const handleZodError = (
  res: Response,
  parsed: any,
  status: number = 400,
) => {
  const messages = parsed.error.issues.map((issue: any) => issue.message);
  res.status(status).json({
    error: messages,
    issues: parsed.error.format(),
  });
  return;
};
