import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../errors/app-error";
import { User } from "../models/user";
import { Repository } from "typeorm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";

export class AuthService {
  constructor(private userRepository: Repository<User>) {}

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
      throw new ConflictError("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.userRepository.save({
      email,
      password: hashedPassword,
      name,
      locale,
    });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedError("Unauthorized: no token provided");
    }

    const token = jwt.sign({ ...user, userId: user.id }, secret, {
      expiresIn: "24h",
    });

    return {
      user,
      token,
    };
  }

  async login({ email, password }: { email: string; password: string }) {
    const user = await this.userRepository.findOne({
      where: { email },
      select: [
        "id",
        "email",
        "password",
        "name",
        "profilePictureUrl",
        "locale",
      ],
    });

    console.log();

    if (!user) {
      throw new NotFoundError("Invalid email or password");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new NotFoundError("Invalid email or password");
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new UnauthorizedError("Unauthorized: no token provided");
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        profilePictureUrl: user.profilePictureUrl,
        locale: user.locale,
      },
      secret,
      {
        expiresIn: "24h",
      },
    );

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      profilePictureUrl: user.profilePictureUrl,
      locale: user.locale,
    };

    return {
      user: userData,
      token,
    };
  }

  async validateToken(token: string) {
    try {
      const secret = process.env.JWT_SECRET;

      if (!secret) {
        throw new UnauthorizedError("Unauthorized: no token provided");
      }

      const decoded = jwt.verify(token, secret);

      if (!isValidJwtPayload(decoded)) {
        throw new Error("Invalid token payload structure");
      }

      const user = await this.userRepository.findOneBy({ id: decoded.userId });

      if (!user) {
        throw new NotFoundError("User not found");
      }

      const { id, email, name, profilePictureUrl, locale } = user;

      return { userId: id, email, name, profilePictureUrl, locale };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Token validation failed: ${errorMessage}`);
    }
  }

  async updateUser({
    id,
    locale,
    name,
    email,
    password,
    profilePictureUrl,
  }: User) {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    user.locale = locale ?? user.locale;
    user.name = name ?? user.name;
    user.email = email ?? user.email;
    user.profilePictureUrl = profilePictureUrl ?? user.profilePictureUrl;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }

    const updatedUser = await this.userRepository.save(user);

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedError("Unauthorized: no token provided");
    }

    const token = jwt.sign(
      {
        userId: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        profilePictureUrl: updatedUser.profilePictureUrl,
        locale: updatedUser.locale,
      },
      secret,
      {
        expiresIn: "24h",
      },
    );

    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        profilePictureUrl: updatedUser.profilePictureUrl,
        locale: updatedUser.locale,
      },
      token,
    };
  }
}

export const authService = new AuthService(AppDataSource.getRepository(User));

interface JwtPayload {
  userId: number;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

function isValidJwtPayload(payload: any): payload is JwtPayload {
  return (
    payload &&
    typeof payload === "object" &&
    typeof payload.userId === "number" &&
    typeof payload.email === "string"
  );
}
