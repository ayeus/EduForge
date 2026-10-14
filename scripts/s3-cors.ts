/**
 * Applies the CORS rules browsers need for direct (presigned) uploads and video playback.
 *   pnpm tsx scripts/s3-cors.ts https://your-domain.com [https://other-origin ...]
 * Uses AWS_* and S3_BUCKET_NAME from .env / .env.local. Replaces the bucket's existing CORS config.
 */
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const origins = process.argv.slice(2);
  const Bucket = process.env.S3_BUCKET_NAME;
  if (!Bucket) throw new Error("S3_BUCKET_NAME is not set");
  const s3 = new S3Client({ region: process.env.AWS_REGION?.trim() });

  if (!origins.length) {
    const current = await s3.send(new GetBucketCorsCommand({ Bucket })).catch(() => null);
    console.log(JSON.stringify(current?.CORSRules ?? "no CORS rules", null, 2));
    console.log("\nPass one or more origins to apply rules, e.g. https://eduforge.vercel.app");
    return;
  }
  await s3.send(
    new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["Content-Type"],
            ExposeHeaders: ["ETag", "Content-Range", "Accept-Ranges", "Content-Length"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log(`CORS applied to ${Bucket} for: ${origins.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
