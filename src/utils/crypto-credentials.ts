import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { config } from "../config/environment";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

export interface EncryptedCredential {
  ciphertext: string;
  iv: string;
  authTag: string;
}

function getMasterKey(): Buffer {
  const key = Buffer.from(config.cryptoMasterKey, "base64");
  if (key.length !== 32) {
    throw new Error(
      "CRYPTO_MASTER_KEY inválida: precisa decodificar (base64) para 32 bytes",
    );
  }
  return key;
}

export function encrypt(plaintext: string): EncryptedCredential {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, getMasterKey(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decrypt(encrypted: EncryptedCredential): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    getMasterKey(),
    Buffer.from(encrypted.iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
