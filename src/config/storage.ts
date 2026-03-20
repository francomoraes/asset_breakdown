import fs from "fs/promises";
import path from "path";
import { config } from "./environment";
import { getSupabaseAdminClient } from "./supabase";

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
    const supabase = getSupabaseAdminClient();
    const extension = file.mimetype.split("/")[1] || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const objectPath = `users/${userId}/${filename}`;

    const { error } = await supabase.storage
      .from(config.supabaseStorageBucket)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    const { data } = supabase.storage
      .from(config.supabaseStorageBucket)
      .getPublicUrl(objectPath);

    return data.publicUrl;
  }

  async delete(fileUrl: string): Promise<void> {
    const supabase = getSupabaseAdminClient();

    const bucketMarker = `/${config.supabaseStorageBucket}/`;
    const markerIndex = fileUrl.indexOf(bucketMarker);

    if (markerIndex === -1) {
      return;
    }

    const objectPath = fileUrl.slice(markerIndex + bucketMarker.length);
    if (!objectPath) {
      return;
    }

    await supabase.storage.from(config.supabaseStorageBucket).remove([objectPath]);
  }
}

const hasSupabaseStorageConfig =
  Boolean(config.supabaseUrl) &&
  Boolean(config.supabaseServiceRoleKey) &&
  Boolean(config.supabaseStorageBucket);

export const storageAdapter: StorageAdapter = hasSupabaseStorageConfig
  ? new SupabaseStorageAdapter()
  : new LocalStorageAdapter();
