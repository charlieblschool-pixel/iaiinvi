import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM at rest for vendor portal passwords. VENDOR_CREDENTIAL_SECRET
// must be a 32-byte key, base64-encoded (openssl rand -base64 32).
function getKey(): Buffer {
  const secret = process.env.VENDOR_CREDENTIAL_SECRET;
  if (!secret) {
    throw new Error("VENDOR_CREDENTIAL_SECRET is not set");
  }
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) {
    throw new Error("VENDOR_CREDENTIAL_SECRET must decode to 32 bytes");
  }
  return key;
}

export function encryptVendorPassword(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(".");
}

export function decryptVendorPassword(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
