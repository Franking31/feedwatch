import { PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3, BUCKET } from "./backup-lib";

const show = (v?: string, n = 4) =>
  v ? `${v.slice(0, n)}... (${v.length} caractères)` : "VIDE";

console.log("Endpoint  :", process.env.S3_ENDPOINT);
console.log("Région    :", process.env.S3_REGION);
console.log("Bucket    :", JSON.stringify(BUCKET));
console.log("Clé ID    :", show(process.env.S3_ACCESS_KEY_ID, 12));
console.log("Secret    :", show(process.env.S3_SECRET_ACCESS_KEY, 4));
console.log("PathStyle :", process.env.S3_FORCE_PATH_STYLE ?? "(non défini)");
console.log("");

async function main() {
  try {
    await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 1 }));
    console.log("LECTURE   : OK");
  } catch (e) {
    const err = e as Error;
    console.log("LECTURE   : ÉCHEC ->", err.name, "-", err.message);
  }

  try {
    await s3.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: "test.txt", Body: "ok" })
    );
    console.log("ÉCRITURE  : OK");
  } catch (e) {
    const err = e as Error;
    console.log("ÉCRITURE  : ÉCHEC ->", err.name, "-", err.message);
  }
}

main();