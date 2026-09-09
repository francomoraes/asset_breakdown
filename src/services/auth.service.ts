import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../errors/app-error";
import { User } from "../models/user";
import { UserRole } from "../enums/role.enum";
import { Repository } from "typeorm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { storageAdapter } from "../config/storage";

type UpdateUserData = {
  id: number;
  locale?: string;
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
  profilePictureUrl?: string | null;
};

interface AccessTokenPayload {
  userId: number;
  email: string;
  name: string;
  profilePictureUrl: string | null;
  locale: string | null;
  type: "access";
}

interface RefreshTokenPayload {
  userId: number;
  type: "refresh";
}

export class AuthService {
  constructor(private userRepository: Repository<User>) {}

  private getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new UnauthorizedError("Unauthorized: no token provided");
    return secret;
  }

  private generateAccessToken(user: Pick<User, "id" | "email" | "name" | "profilePictureUrl" | "locale">): string {
    return jwt.sign(
      {
        userId: user.id!,
        email: user.email,
        name: user.name,
        profilePictureUrl: user.profilePictureUrl,
        locale: user.locale,
        type: "access",
      } satisfies AccessTokenPayload,
      this.getSecret(),
      { expiresIn: "15m" },
    );
  }

  generateRefreshToken(userId: number): string {
    return jwt.sign(
      { userId, type: "refresh" } satisfies RefreshTokenPayload,
      this.getSecret(),
      { expiresIn: "7d" },
    );
  }

  verifyRefreshToken(token: string): number {
    try {
      const decoded = jwt.verify(token, this.getSecret());
      if (
        !decoded ||
        typeof decoded !== "object" ||
        (decoded as any).type !== "refresh" ||
        typeof (decoded as any).userId !== "number"
      ) {
        throw new Error("Invalid refresh token");
      }
      return (decoded as RefreshTokenPayload).userId;
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
  }

  async register({
    email,
    password,
    name,
    locale = "pt-br",
  }: {
    email: string;
    password: string;
    name: string;
    locale?: string;
  }) {
    const existingUser = await this.userRepository.findOneBy({ email });

    if (existingUser) {
      throw new ConflictError("User already exists", "USER_ALREADY_EXISTS");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.userRepository.save({
      email,
      password: hashedPassword,
      name,
      locale,
      role: UserRole.INVESTOR,
      selfServiceEnabled: false,
    });

    const token = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user.id!);

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      profilePictureUrl: user.profilePictureUrl,
      locale: user.locale,
      role: user.role,
      selfServiceEnabled: user.selfServiceEnabled,
      riskProfile: user.riskProfile,
    };

    return { user: userData, token, refreshToken };
  }

  async login({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) {
    const user = await this.userRepository.findOne({
      where: { email },
      select: [
        "id",
        "email",
        "password",
        "name",
        "profilePictureUrl",
        "locale",
        "role",
        "selfServiceEnabled",
        "riskProfile",
      ],
    });

    if (!user) {
      throw new NotFoundError(
        "Invalid email or password",
        "INVALID_CREDENTIALS",
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new NotFoundError(
        "Invalid email or password",
        "INVALID_CREDENTIALS",
      );
    }

    const token = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user.id!);

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      profilePictureUrl: user.profilePictureUrl,
      locale: user.locale,
      role: user.role,
      selfServiceEnabled: user.selfServiceEnabled,
      riskProfile: user.riskProfile,
    };

    return { user: userData, token, refreshToken };
  }

  async validateToken(token: string) {
    try {
      const decoded = jwt.verify(token, this.getSecret());

      if (!isValidAccessTokenPayload(decoded)) {
        throw new Error("Invalid token payload structure");
      }

      const user = await this.userRepository.findOneBy({ id: decoded.userId });

      if (!user) {
        throw new NotFoundError("User not found");
      }

      const { id, email, name, profilePictureUrl, locale, role } = user;
      return { userId: id!, email, name, profilePictureUrl, locale, role };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Token validation failed: ${errorMessage}`);
    }
  }

  async refreshSession(refreshToken: string) {
    const userId = this.verifyRefreshToken(refreshToken);

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        "id",
        "email",
        "name",
        "profilePictureUrl",
        "locale",
        "role",
        "selfServiceEnabled",
        "riskProfile",
      ],
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const token = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user.id!);

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      profilePictureUrl: user.profilePictureUrl,
      locale: user.locale,
      role: user.role,
      selfServiceEnabled: user.selfServiceEnabled,
    };

    return { user: userData, token, refreshToken: newRefreshToken };
  }

  private async cleanupOrphanedPhotos(previousUrl: string | null) {
    if (!previousUrl) return;
    try {
      await storageAdapter.delete(previousUrl);
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }

  async updateUser({
    id,
    locale,
    name,
    email,
    currentPassword,
    newPassword,
    profilePictureUrl,
  }: UpdateUserData) {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        "id",
        "email",
        "name",
        "password",
        "locale",
        "profilePictureUrl",
        "role",
        "selfServiceEnabled",
        "riskProfile",
      ],
    });

    if (!user) {
      throw new NotFoundError("User not found", "USER_NOT_FOUND");
    }

    user.locale = locale ?? user.locale;
    user.name = name ?? user.name;
    user.email = email ?? user.email;

    if (profilePictureUrl !== undefined) {
      const previousProfilePictureUrl = user.profilePictureUrl;
      user.profilePictureUrl = profilePictureUrl;

      if (
        previousProfilePictureUrl &&
        previousProfilePictureUrl !== profilePictureUrl
      ) {
        await this.cleanupOrphanedPhotos(previousProfilePictureUrl);
      }
    }

    if (newPassword) {
      if (!currentPassword) {
        throw new UnauthorizedError(
          "Current password is required to set a new password",
          "CURRENT_PASSWORD_REQUIRED",
        );
      }
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isValidPassword) {
        throw new UnauthorizedError(
          "Current password is incorrect",
          "INVALID_CURRENT_PASSWORD",
        );
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
    }

    const updatedUser = await this.userRepository.save(user);

    const token = this.generateAccessToken(updatedUser);
    const refreshToken = this.generateRefreshToken(updatedUser.id!);

    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        profilePictureUrl: updatedUser.profilePictureUrl,
        locale: updatedUser.locale,
        role: updatedUser.role,
        selfServiceEnabled: updatedUser.selfServiceEnabled,
        riskProfile: updatedUser.riskProfile,
      },
      token,
      refreshToken,
    };
  }
}

export const authService = new AuthService(AppDataSource.getRepository(User));

function isValidAccessTokenPayload(payload: unknown): payload is AccessTokenPayload {
  return (
    payload !== null &&
    typeof payload === "object" &&
    typeof (payload as any).userId === "number" &&
    typeof (payload as any).email === "string" &&
    (payload as any).type === "access"
  );
}
