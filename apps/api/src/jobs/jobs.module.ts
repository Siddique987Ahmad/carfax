import { Module } from '@nestjs/common';
import { CorrectionRequestsController } from './correction-requests.controller';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

/** The garage's jobs outside sync: list, detail (api/10) and correction requests (api/08b). */
@Module({ controllers: [JobsController, CorrectionRequestsController], providers: [JobsService] })
export class JobsModule {}
