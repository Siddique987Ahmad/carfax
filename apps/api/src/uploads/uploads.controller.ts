import { type Db, schema, withSystem } from '@carfax/db';
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { eq } from 'drizzle-orm';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentGarage, type GarageContext, GaragePermission } from '../access/access.decorators';
import { DB } from '../db/db.module';
import { AppError } from '../errors/app-error';
import { StorageService } from '../storage/storage.module';

/** The app compresses photos before uploading (api/07). */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const UPLOAD_URL_SECONDS = 10 * 60;

/** Where a job photo lives. Built by the server from the caller's own garage, never by the app. */
export const photoKey = (garageId: string, jobId: string, photoId: string) =>
  `jobs/${garageId}/${jobId}/${photoId}.jpg`;

class SignUploadDto extends createZodDto(
  z.object({
    jobId: z.uuid().describe('The job id (made on the phone; the job may not be synced yet)'),
    photoId: z.uuid().describe('The photo id (made on the phone)'),
    kind: z.enum(['odometer', 'before', 'after']),
    contentType: z.literal('image/jpeg', { error: 'Only JPEG photos' }),
    size: z.number().int().min(1).max(MAX_PHOTO_BYTES, { error: 'Photos must be 2 MB or smaller' }),
  }),
) {}

class SignedUploadDto extends createZodDto(
  z.object({
    uploadUrl: z.string(),
    method: z.literal('PUT'),
    /** Send exactly these headers with the upload, or storage refuses it. */
    headers: z.object({ 'content-type': z.literal('image/jpeg'), 'content-length': z.string() }),
    /** Send this back with the photo in sync push (api/08). */
    storageKey: z.string(),
    expiresAt: z.iso.datetime(),
  }),
) {}

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly storage: StorageService,
    @Inject(DB) private readonly db: Db,
  ) {}

  /**
   * A 10-minute URL to upload one photo straight to private storage. Photos are usually uploaded
   * before their job syncs, so the job may not exist here yet; the storage key always sits under the
   * caller's own garage, and sync push checks that it matches the job's garage.
   */
  @Post('sign')
  @HttpCode(200)
  @GaragePermission('jobs.create')
  @ApiOkResponse({ type: SignedUploadDto })
  async sign(@Body() body: SignUploadDto, @CurrentGarage() garage: GarageContext) {
    // If the job is already here, it must be this garage's.
    const [job] = await withSystem(this.db, (tx) =>
      tx
        .select({ garageId: schema.jobs.garageId })
        .from(schema.jobs)
        .where(eq(schema.jobs.id, body.jobId)),
    );
    if (job && job.garageId !== garage.garageId) {
      throw new AppError('FORBIDDEN', 403, 'That job belongs to another garage');
    }

    const storageKey = photoKey(garage.garageId, body.jobId, body.photoId);
    const uploadUrl = await this.storage.signUpload(
      this.storage.photosBucket,
      storageKey,
      body.contentType,
      body.size,
      UPLOAD_URL_SECONDS,
    );
    return {
      uploadUrl,
      method: 'PUT' as const,
      headers: { 'content-type': 'image/jpeg' as const, 'content-length': String(body.size) },
      storageKey,
      expiresAt: new Date(Date.now() + UPLOAD_URL_SECONDS * 1000).toISOString(),
    };
  }
}
