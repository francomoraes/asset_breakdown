import fs from "fs/promises";
import path from "path";

interface StorageAdapter {
  upload(file: Express.Multer.File, userId: number): Promise<string>;
  delete(fileUrl: string): Promise<void>;
}

class LocalStorageAdapter implements StorageAdapter {
  private uploadDir = path.join(__dirname, "../../uploads/profile-pictures");

  async upload(file: Express.Multer.File, userId: number): Promise<string> {
    await fs.mkdir(this.uploadDir, { recursive: true });

    const timestamp = Date.now();
    const extension = file.mimetype.split("/")[1];
    const filename = `${userId}-${timestamp}.${extension}`;

    const filePath = path.join(this.uploadDir, filename);

    await fs.writeFile(filePath, file.buffer);

    return `http://localhost:3000/api/uploads/profile-pictures/${filename}`;
  }

  async delete(fileUrl: string): Promise<void> {
    const fileName = fileUrl.split("/").pop();
    if (!fileName) return;

    const filePath = path.join(this.uploadDir, fileName);

    await fs.rm(filePath, { force: true });
  }
}

class SupabaseStorageAdapter implements StorageAdapter {
  async upload(file: Express.Multer.File, userId: number): Promise<string> {
    // const { data } = await supabase.storage
    //   .from("profile-pictures")
    //   .upload(`${userId}/${file.filename}`, file.buffer)
    // return data?.publicUrl || "";
    return "";
  }

  async delete(fileUrl: string): Promise<void> {
    // const { data } = await supabase.storage
    //   .from("profile-pictures")
    //   .remove([fileUrl]);
  }
}

export const storageAdapter: StorageAdapter =
  process.env.NODE_ENV === "production"
    ? new SupabaseStorageAdapter()
    : new LocalStorageAdapter();
