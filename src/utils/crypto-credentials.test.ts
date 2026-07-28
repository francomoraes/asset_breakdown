import { describe, it, expect, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import { config } from "../config/environment";
import { encrypt, decrypt } from "./crypto-credentials";

describe("crypto-credentials", () => {
  beforeEach(() => {
    config.cryptoMasterKey = randomBytes(32).toString("base64");
  });

  it("faz roundtrip de encrypt/decrypt corretamente", () => {
    const plaintext = "super-secret-api-key";
    const encrypted = encrypt(plaintext);

    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("gera iv/ciphertext diferentes a cada chamada (nunca reusa IV)", () => {
    const a = encrypt("same-plaintext");
    const b = encrypt("same-plaintext");

    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("falha ao decriptar com a chave errada", () => {
    const encrypted = encrypt("secret-value");
    config.cryptoMasterKey = randomBytes(32).toString("base64");

    expect(() => decrypt(encrypted)).toThrow();
  });

  it("falha ao decriptar ciphertext adulterado (autenticação do GCM)", () => {
    const encrypted = encrypt("secret-value");
    const tampered = {
      ...encrypted,
      ciphertext: Buffer.from("adulterado").toString("base64"),
    };

    expect(() => decrypt(tampered)).toThrow();
  });
});
