import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CurrentGarage,
  CurrentUser,
  type GarageContext,
  GaragePermission,
} from '../access/access.decorators';
import type { SessionUser } from '../auth/token.service';
import { CUSTOMER_SEARCH_MAX, CustomersService } from './customers.service';

class SearchQueryDto extends createZodDto(
  z.object({
    q: z.string().trim().max(80).optional().describe('Part of a name or phone number'),
    limit: z.coerce.number().int().min(1).max(CUSTOMER_SEARCH_MAX).default(50),
  }),
) {}

const CarSchema = z.object({
  id: z.uuid(),
  regNo: z.string().nullable(),
  make: z.string().nullable(),
  model: z.string().nullable(),
});
class CustomerListDto extends createZodDto(
  z.array(
    z.object({
      id: z.uuid(),
      name: z.string().nullable(),
      phone: z.string().nullable(),
      lastVisit: z.iso.date().nullable(),
      visits: z.number(),
      cars: z.array(CarSchema),
    }),
  ),
) {}
class CustomerDetailDto extends createZodDto(
  z.object({
    id: z.uuid(),
    name: z.string().nullable(),
    phone: z.string().nullable(),
    visits: z.array(
      z.object({
        id: z.uuid(),
        serviceDate: z.iso.date(),
        carId: z.uuid(),
        regNo: z.string().nullable(),
        make: z.string().nullable(),
        model: z.string().nullable(),
        status: z.string(),
        totalPkr: z.number().nullable(),
        workTypes: z.array(z.string()),
      }),
    ),
    reminders: z.array(
      z.object({
        id: z.uuid(),
        kind: z.string(),
        dueDate: z.iso.date(),
        status: z.string(),
        carId: z.uuid(),
      }),
    ),
  }),
) {}

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  /** Search the garage's customers by part of a name or phone, with their cars and last visit. */
  @Get()
  @GaragePermission('customers.view')
  @ApiOkResponse({ type: CustomerListDto })
  search(@Query() query: SearchQueryDto, @CurrentGarage() garage: GarageContext) {
    return this.customers.search(garage, query.q, query.limit);
  }

  /** One customer: visits (newest first) and reminders. */
  @Get(':id')
  @GaragePermission('customers.view')
  @ApiOkResponse({ type: CustomerDetailDto })
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentGarage() garage: GarageContext,
    @CurrentUser() user: SessionUser,
  ) {
    return this.customers.detail(garage, user.id, id);
  }

  /** Owner only: a privacy request. Clears the name and phone; the car's jobs stay. */
  @Delete(':id')
  @HttpCode(204)
  @GaragePermission('customers.delete')
  async delete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentGarage() garage: GarageContext,
    @CurrentUser() user: SessionUser,
  ) {
    await this.customers.delete(garage, user.id, id);
  }
}
