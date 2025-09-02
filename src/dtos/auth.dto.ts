import { z } from "zod";

export const RegisterDTO = z
  .object({
    email: z.string().email(),
    password: z
      .string()
      .min(6)
      .max(100)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        "Password must contain uppercase, lowercase, numbers and symbols",
      ),
  })
  .strict();

export const LoginDTO = z
  .object({
    email: z.string().email(),
    password: z.string().min(6).max(100),
  })
  .strict();

export const AuthResponseDto = z.object({});
