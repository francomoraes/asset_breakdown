declare namespace Express {
  interface Request {
    user?: {
      userId: number;
      email: string;
      name: string;
      profilePictureUrl: string | null;
      locale: string | null;
      role: import("enums/role.enum").UserRole;
    };
    effectiveUserId?: number;
  }
}
