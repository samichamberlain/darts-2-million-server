import crypto from "node:crypto";

const iterations = 600000;
const keyLength = 64;
const digest = "sha256";

export function sha256(text: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(text, salt, iterations, keyLength, digest)
    .toString("hex");

  return { hash, salt };
}

export function verifySha256(
  text: string,
  salt: string,
  originalHash: string,
): boolean {
  const verify = crypto
    .pbkdf2Sync(text, salt, iterations, keyLength, digest)
    .toString("hex");

  return verify === originalHash;
}
