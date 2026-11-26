import { canonicalCar, ChassisNoSchema, RegNoSchema } from '@carfax/shared';
import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentUser, GaragePermission } from '../access/access.decorators';
import type { SessionUser } from '../auth/token.service';
import { CarIdentityService } from './car-identity.service';

const thisYear = new Date().getFullYear();

class LookupQueryDto extends createZodDto(
  z
    .object({ reg: RegNoSchema.optional(), chassis: ChassisNoSchema.optional() })
    .refine((q) => Boolean(q.reg) !== Boolean(q.chassis), 'Give either reg or chassis'),
) {}

class ResolveCarDto extends createZodDto(
  z
    .object({
      id: z
        .uuid()
        .optional()
        .describe('The id the phone made for this car, if it was added offline'),
      regNo: RegNoSchema.optional(),
      regYear: z
        .number()
        .int()
        .min(1950)
        .max(thisYear + 1)
        .optional(),
      chassisNo: ChassisNoSchema.optional(),
      make: z.string().trim().min(1).max(40).optional(),
      model: z.string().trim().min(1).max(40).optional(),
      year: z
        .number()
        .int()
        .min(1950)
        .max(thisYear + 1)
        .optional(),
      differentCar: z.boolean().optional().describe('The car found for this plate is not this car'),
    })
    .refine((c) => c.regNo || c.chassisNo, {
      message: 'A plate or a chassis number is needed',
      path: ['regNo'],
    })
    .transform((c) => ({ ...c, ...(c.make && canonicalCar(c.make, c.model)) })),
) {}

const CarSummarySchema = z.object({
  id: z.uuid(),
  regNo: z.string().nullable(),
  chassisLast4: z.string().nullable(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  year: z.number().nullable(),
});
class LookupDto extends createZodDto(
  z.object({ found: z.boolean(), car: CarSummarySchema.optional() }),
) {}
class ResolvedDto extends createZodDto(
  z.object({
    carId: z.uuid(),
    created: z.boolean(),
    remappedFrom: z.uuid().optional().describe('Replace this id with carId on the phone'),
    possibleDuplicate: z.boolean().optional(),
    plateMoved: z.boolean().optional(),
    car: CarSummarySchema,
  }),
) {}

@ApiTags('cars')
@Controller('cars')
export class CarsController {
  constructor(private readonly cars: CarIdentityService) {}

  /** Finds the car that has this plate (or chassis) now. Shows the car only, never other garages' jobs. */
  @Get('lookup')
  @GaragePermission('jobs.view')
  @ApiOkResponse({ type: LookupDto })
  async lookup(@Query() query: LookupQueryDto) {
    const car = await this.cars.lookup({ regNo: query.reg, chassisNo: query.chassis });
    return car ? { found: true, car } : { found: false };
  }

  /**
   * Finds or adds a car. Safe to resend: the same phone id always gives the same answer. If another
   * garage already added this car, the answer says so with `remappedFrom`.
   */
  @Post()
  @GaragePermission('jobs.create')
  @HttpCode(200)
  @ApiOkResponse({ type: ResolvedDto })
  async resolve(@Body() body: ResolveCarDto, @CurrentUser() user: SessionUser) {
    const result = await this.cars.resolve(body, user.id);
    return { ...result, car: await this.cars.summary(result.carId) };
  }
}
