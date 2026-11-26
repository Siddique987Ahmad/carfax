import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Global, Injectable, Module } from '@nestjs/common';
import { getConfig } from '../config';

/**
 * Private photo and report storage: Cloudflare R2, or SeaweedFS locally (api/07). Files never pass
 * through the API: phones upload and readers download with short-lived signed URLs, and the
 * buckets are never public.
 */
@Injectable()
export class StorageService {
  private readonly config = getConfig();
  // Talks to storage from the API itself (existence checks).
  private readonly internal = this.client(this.config.S3_ENDPOINT);
  // Signs URLs for phones, with the address they can reach.
  private readonly forPhones = this.client(
    this.config.S3_PUBLIC_ENDPOINT || this.config.S3_ENDPOINT,
  );

  private client(endpoint: string) {
    return new S3Client({
      endpoint,
      region: this.config.S3_REGION,
      forcePathStyle: this.config.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: this.config.S3_ACCESS_KEY_ID,
        secretAccessKey: this.config.S3_SECRET_ACCESS_KEY,
      },
      // Otherwise the SDK signs a checksum of an empty body into presigned URLs and every real
      // upload fails with BadDigest (found in setup/03).
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  get photosBucket() {
    return this.config.S3_BUCKET_PHOTOS;
  }

  /**
   * A URL to upload exactly one file. The content type and length are part of the signature, so an
   * upload of any other size or type is refused by storage itself.
   */
  signUpload(
    bucket: string,
    key: string,
    contentType: string,
    contentLength: number,
    expiresIn: number,
  ) {
    return getSignedUrl(
      this.forPhones,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      }),
      { expiresIn, signableHeaders: new Set(['content-type', 'content-length']) },
    );
  }

  /** A short-lived URL to read a private file. */
  signDownload(bucket: string, key: string, expiresIn = 300) {
    return getSignedUrl(this.forPhones, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn,
    });
  }

  /** The file's size and type, or null if it isn't there (sync push checks this, api/08). */
  async head(bucket: string, key: string): Promise<{ size: number; contentType?: string } | null> {
    try {
      const res = await this.internal.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { size: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404) return null;
      throw error;
    }
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
