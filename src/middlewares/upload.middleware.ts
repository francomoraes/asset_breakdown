import multer from "multer";
import { NextFunction, Request, Response } from "express";

const storage = multer.memoryStorage();

const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
];

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (ACCEPTED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, JPG, and WEBP are allowed.",
      ),
    );
  }
};

const limits = {
  fileSize: 1 * 1024 * 1024, // 1 MB
};

export const uploadProfilePicture = multer({
  storage,
  fileFilter,
  limits,
}).single("file");

function detectMimeFromBuffer(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: RIFF????WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export const validateImageBytes = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const file = req.file;
  if (!file) return next();

  const detected = detectMimeFromBuffer(file.buffer);
  if (!detected || !ACCEPTED_FILE_TYPES.includes(detected)) {
    res.status(400).json({
      error:
        "Invalid file: binary content does not match an accepted image format.",
    });
    return;
  }

  file.mimetype = detected;
  next();
};
