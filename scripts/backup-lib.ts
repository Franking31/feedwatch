import "dotenv/config";
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";
import { S3Client} from "@aws-sdk/client-s3";

export function env(name: string): string {
    const value = process.env[name];
    if(!value) throw new Error(`variable manquante dans env : ${name}`);
    return value;
}

export const BUCKET = env("S3_BUCKET");
export const PREFIX = "feedWatch/";

export const s3 = new S3Client({
    endpoint: env("S3_ENDPOINT"),
    region: env("S3_REGION"),
    credentials: {
        accessKeyId: env("S3_ACCESS_KEY_ID"),
        secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
    }, 
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    // Réglages pour rester compatible avec les stockages S3 hors Amazon
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",

});

// Format du fichier chiffré : "FWB1" + sel + iv + données + tag d'authentification

const MAGIC = Buffer.from("FWB1");

export function encrypt(data: Buffer): Buffer {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = scryptSync(env("BACKUP_PASSPHRASE"), salt, 32);
    const cipher =createCipheriv("aes-256-gcm", key, iv);
    const body = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([MAGIC, salt, iv, body, cipher.getAuthTag()]);
}

export function decrypt(file: Buffer): Buffer {
  if (!file.subarray(0, 4).equals(MAGIC)) {
    throw new Error("Fichier de sauvegarde invalide");
  }
  const salt = file.subarray(4, 20);
  const iv = file.subarray(20, 32);
  const tag = file.subarray(file.length - 16);
  const body = file.subarray(32, file.length - 16);
  const key = scryptSync(env("BACKUP_PASSPHRASE"), salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}