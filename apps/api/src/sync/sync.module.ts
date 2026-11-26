import { Module } from '@nestjs/common';
import { CarsModule } from '../cars/cars.module';
import { RemindersModule } from '../reminders/reminders.module';
import { SyncController } from './sync.controller';
import { SyncPullService } from './sync-pull.service';
import { SyncService } from './sync.service';

@Module({
  imports: [CarsModule, RemindersModule],
  controllers: [SyncController],
  providers: [SyncService, SyncPullService],
})
export class SyncModule {}
