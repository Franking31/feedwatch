import { exec } from "node:child_process";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import {
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { s3, BUCKET, PREFIX, encrypt } from "./backup-lib";

const run = promisify(exec);

// Par défaut : on exporte depuis le conteneur Docker de ta base locale.
// Sur le serveur, on remplacera cette commande via BACKUP_DUMP_CMD.
const DUMP_CMD =
  process.env.BACKUP_DUMP_CMD ??
  "docker compose exec -T db pg_dump -U feedwatch -d feedwatch --no-owner --clean --if-exists";
const KEEP = Number(process.env.BACKUP_KEEP ?? "30");

async function main() {
  console.log("1/4 Export de la base...");
  const { stdout } = await run(DUMP_CMD, {
    encoding: "buffer",
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (stdout.length < 100) {
    throw new Error("L'export est vide : sauvegarde annulée.");
  }

  console.log("2/4 Compression et chiffrement...");
  const file = encrypt(gzipSync(stdout));

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `${PREFIX}feedwatch-${stamp}.sql.gz.enc`;

  console.log(`3/4 Envoi vers le cloud (${Math.round(file.length / 1024)} Ko)...`);
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: file }));
  console.log(`    OK : ${key}`);

  console.log("4/4 Nettoyage des anciennes sauvegardes...");
  const list = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX })
  );
  const keys = (list.Contents ?? [])
    .map((o) => o.Key as string)
    .filter((k) => k.endsWith(".sql.gz.enc"))
    .sort(); // la date est dans le nom : ordre alphabétique = ordre chronologique

  const old = keys.slice(0, Math.max(0, keys.length - KEEP));
  if (old.length > 0) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: old.map((Key) => ({ Key })) },
      })
    );
  }
  console.log(`    ${old.length} supprimée(s), ${keys.length - old.length} conservée(s).`);
}

main().catch((err) => {
  console.error("ÉCHEC de la sauvegarde :", err.message);
  process.exit(1);
});