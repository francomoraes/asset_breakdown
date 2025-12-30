import multer from "multer";

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
