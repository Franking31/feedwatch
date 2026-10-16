import { spawn } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3, BUCKET, PREFIX, decrypt } from "./backup-lib";

// Sécurité : par défaut on restaure dans une base de TEST, jamais dans la vraie.
const RESTORE_DB = process.env.RESTORE_DB ?? "feedwatch_restore_test";
const RESTORE_CMD =
  process.env.RESTORE_CMD ??
  `docker compose exec -T db psql -U feedwatch -d ${RESTORE_DB} -v ON_ERROR_STOP=1`;

async function listBackups(): Promise<string[]> {
  const list = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX })
  );
  return (list.Contents ?? [])
    .map((o) => o.Key as string)
    .filter((k) => k.endsWith(".sql.gz.enc"))
    .sort();
}

async function main() {
  const arg = process.argv[2];
  const backups = await listBackups();

  if (!arg || arg === "list") {
    backups.forEach((k) => console.log(k));
    console.log("\nPour restaurer : npm run restore -- latest");
    return;
  }

  const key = arg === "latest" ? backups[backups.length - 1] : arg;
  if (!key) throw new Error("Aucune sauvegarde trouvée.");

  console.log(`Téléchargement : ${key}`);
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const encrypted = Buffer.from(await res.Body!.transformToByteArray());

  let sql: Buffer;
  try {
    sql = gunzipSync(decrypt(encrypted));
  } catch {
    throw new Error(
      "Déchiffrement impossible : mauvaise BACKUP_PASSPHRASE ou fichier corrompu."
    );
  }

  console.log(`Restauration dans la base « ${RESTORE_DB} »...`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(RESTORE_CMD, {
      shell: true,
      stdio: ["pipe", "inherit", "inherit"],
    });
    child.on("error", reject);
    child.stdin.on("error", () => {});
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`psql a échoué (code ${code})`))
    );
    child.stdin.end(sql);
  });
  console.log("Restauration terminée.");
}

main().catch((err) => {
  console.error("ÉCHEC :", err.message);
  process.exit(1);
});