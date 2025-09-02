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

  async register({ email, password }: { email: string; password: string }) {
    const existingUser = await this.userRepository.findOneBy({ email });

    if (existingUser) {
      throw new ConflictError("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.userRepository.save({
      email,
      password: hashedPassword,
    });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedError("Unauthorized: no token provided");
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, secret, {
      expiresIn: "24h",
    });

    return {
      user: { id: user.id, email: user.email },
      token,
    };
  }

  async login({ email, password }: { email: string; password: string }) {
    const user = await this.userRepository.findOne({
      where: { email },
      select: ["id", "email", "password"],
    });

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

    const token = jwt.sign({ userId: user.id, email: user.email }, secret, {
      expiresIn: "24h",
    });

    return {
      user: { id: user.id, email: user.email },
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

      return { userId: user.id, email: user.email };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Token validation failed: ${errorMessage}`);
    }
  }
}

export const authService = new AuthService(AppDataSource.getRepository(User));

interface JwtPayload {
  userId: number;
  email: string;
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
