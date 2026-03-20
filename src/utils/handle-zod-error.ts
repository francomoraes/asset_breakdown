import { Response } from "express";
import { ZodError } from "zod";

export const handleZodError = (
  res: Response,
  error: ZodError,
  status: number = 400,
) => {
  const issues = error.issues;
  let messages: string[] = [];
  if (Array.isArray(issues)) {
    messages = issues.map((issue: any) => issue.message);
  } else {
    messages = [error.message];
  }
  res.status(status).json({
    error: messages,
    issues: error.format(),
  });
  return;
};
