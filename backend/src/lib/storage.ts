import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createReadStream, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const useR2 =
  Boolean(env.R2_ENDPOINT) &&
  Boolean(env.R2_ACCESS_KEY_ID) &&
  Boolean(env.R2_SECRET_ACCESS_KEY) &&
  Boolean(env.R2_BUCKET);

let s3: S3Client | null = null;

function getS3(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: "auto",
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3;
}

async function ensureLocalDir(key: string) {
  const full = path.join(env.LOCAL_UPLOAD_DIR, key);
  await mkdir(path.dirname(full), { recursive: true });
  return full;
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
): Promise<string> {
  if (useR2) {
    await getS3().send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET!,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    return key;
  }

  const full = await ensureLocalDir(key);
  await writeFile(full, body);
  return key;
}

export async function putObjectStream(
  key: string,
  stream: Readable,
  contentType?: string
): Promise<string> {
  if (useR2) {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return putObject(key, Buffer.concat(chunks), contentType);
  }

  const full = await ensureLocalDir(key);
  await pipeline(stream, createWriteStream(full));
  return key;
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  if (useR2) {
    const res = await getS3().send(
      new GetObjectCommand({ Bucket: env.R2_BUCKET!, Key: key })
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty object: ${key}`);
    return Buffer.from(bytes);
  }

  const full = path.join(env.LOCAL_UPLOAD_DIR, key);
  return readFile(full);
}

export async function deleteObject(key: string): Promise<void> {
  try {
    if (useR2) {
      await getS3().send(
        new DeleteObjectCommand({ Bucket: env.R2_BUCKET!, Key: key })
      );
      return;
    }
    const full = path.join(env.LOCAL_UPLOAD_DIR, key);
    if (existsSync(full)) await unlink(full);
  } catch (err) {
    logger.warn({ err, key }, "Failed to delete object");
  }
}

export function ensureUploadRoot() {
  if (!useR2 && !existsSync(env.LOCAL_UPLOAD_DIR)) {
    mkdirSync(env.LOCAL_UPLOAD_DIR, { recursive: true });
  }
}

export const storageMode = useR2 ? "r2" : "local";
