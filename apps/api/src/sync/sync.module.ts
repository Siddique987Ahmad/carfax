import { Module } from '@nestjs/common';
import { CarsModule } from '../cars/cars.module';
import { SyncController } from './sync.controller';
import { SyncPullService } from './sync-pull.service';
import { SyncService } from './sync.service';

@Module({
  imports: [CarsModule],
  controllers: [SyncController],
  providers: [SyncService, SyncPullService],
})
export class SyncModule {}
