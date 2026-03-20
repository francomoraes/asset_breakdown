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
    name: z.string().min(2).max(100),
    locale: z.string().optional(),
  })
  .strict();

export const LoginDTO = z
  .object({
    email: z.string().email(),
    password: z.string().min(6).max(100),
  })
  .strict();

export const UpdateUserDto = z.object({
  locale: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().min(2).max(100).optional(),
  profilePictureUrl: z.string().url().optional().nullable(),
  newPassword: z
    .string()
    .min(6)
    .max(100)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain uppercase, lowercase, numbers and symbols",
    )
    .optional(),
  currentPassword: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(6).max(100).optional(),
  ),
});

export const AuthResponseDto = z.object({});
