import { Module } from '@nestjs/common';
import { CorrectionRequestsController } from './correction-requests.controller';

/** Job routes outside sync. api/10 adds the garage's job list and detail here. */
@Module({ controllers: [CorrectionRequestsController] })
export class JobsModule {}
