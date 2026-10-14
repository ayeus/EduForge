import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const globalForS3 = globalThis as unknown as { s3?: S3Client };
const s3 = (globalForS3.s3 ??= new S3Client({ region: process.env.AWS_REGION?.trim() }));

function bucket() {
  const name = process.env.S3_BUCKET_NAME;
  if (!name) throw new Error("S3_BUCKET_NAME is not set");
  return name;
}

export function presignPut(key: string, contentType: string) {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), {
    expiresIn: 60 * 60,
  });
}

export function presignGet(key: string, downloadName?: string) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: downloadName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
        : undefined,
    }),
    { expiresIn: 60 * 60 * 6 },
  );
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
