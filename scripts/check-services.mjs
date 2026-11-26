// Checks that local services work the way the apps will use them:
// uploads and downloads a file through signed URLs, like the garage app's photo upload (api/07).
// Usage: pnpm services:check (after pnpm services:up and pnpm env:init)
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

process.loadEnvFile(new URL('../.env', import.meta.url));
const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from .env (run pnpm env:init)`);
  return value;
};

const s3 = new S3Client({
  endpoint: env('S3_ENDPOINT'),
  region: env('S3_REGION'),
  forcePathStyle: env('S3_FORCE_PATH_STYLE') === 'true',
  credentials: {
    accessKeyId: env('S3_ACCESS_KEY_ID'),
    secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
  },
  // The SDK otherwise signs a checksum of the (empty) body into presigned URLs,
  // so any real upload fails with BadDigest. The API (api/07) needs the same setting.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const bucket = env('S3_BUCKET_PHOTOS');
const key = `checks/${Date.now()}.txt`;
const body = `signed upload check ${new Date().toISOString()}`;

const putUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key }), {
  expiresIn: 60,
});
const put = await fetch(putUrl, { method: 'PUT', body });
if (!put.ok) throw new Error(`Signed upload failed: ${put.status} ${await put.text()}`);

const getUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
  expiresIn: 60,
});
const got = await (await fetch(getUrl)).text();
if (got !== body) throw new Error(`Downloaded content does not match: ${got}`);

const unsigned = await fetch(`${env('S3_ENDPOINT')}/${bucket}/${key}`);
if (unsigned.ok) throw new Error('Bucket is public: an unsigned download succeeded');

await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
console.log(`ok  S3: signed upload and download work, and "${bucket}" is private`);
