import { Module } from '@nestjs/common';
import { CarIdentityService } from './car-identity.service';
import { CarsController } from './cars.controller';

@Module({
  controllers: [CarsController],
  providers: [CarIdentityService],
  exports: [CarIdentityService],
})
export class CarsModule {}
