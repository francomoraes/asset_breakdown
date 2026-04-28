export class ConflictError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ConflictError";
    this.statusCode = 409;
    this.code = code;
  }
}

export class NotFoundError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = 404;
    this.code = code;
  }
}

export class BadRequestError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "BadRequestError";
    this.statusCode = 400;
    this.code = code;
  }
}

export class UnauthorizedError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "UnauthorizedError";
    this.statusCode = 401;
    this.code = code;
  }
}

export class ForbiddenError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ForbiddenError";
    this.statusCode = 403;
    this.code = code;
  }
}
