import { CitySchema, PakistanMobileSchema } from '@carfax/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CurrentGarage,
  CurrentUser,
  type GarageContext,
  GaragePermission,
  SignedIn,
} from '../access/access.decorators';
import type { SessionUser } from '../auth/token.service';
import { GaragesService } from './garages.service';

const ProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  city: CitySchema,
  address: z.string().trim().max(200).nullish(),
  /** From the owner's phone when creating the garage. */
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
});
class CreateGarageDto extends createZodDto(ProfileSchema) {}
class UpdateGarageDto extends createZodDto(
  ProfileSchema.partial().refine((v) => Object.keys(v).length > 0, 'Nothing to change'),
) {}
class AddMechanicDto extends createZodDto(
  z.object({ phone: PakistanMobileSchema, name: z.string().trim().min(2).max(80).optional() }),
) {}

const GarageSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  city: z.string(),
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  status: z.enum(['pending', 'active', 'suspended']),
  /** Shown to the garage when it's suspended. */
  statusReason: z.string().nullable(),
  /** The caller's role in this garage. */
  role: z.enum(['owner', 'mechanic']),
});
class GarageDto extends createZodDto(GarageSchema) {}
const MemberSchema = z.object({
  userId: z.uuid(),
  name: z.string().nullable(),
  phone: z.string(),
  role: z.enum(['owner', 'mechanic']),
});
class MembersDto extends createZodDto(
  z.array(MemberSchema.extend({ addedAt: z.iso.datetime() })),
) {}
class MemberDto extends createZodDto(MemberSchema) {}
class StatsDto extends createZodDto(
  z.object({
    jobsThisWeek: z.number(),
    jobsThisMonth: z.number(),
    earningsThisMonthPkr: z.number(),
    remindersSentThisMonth: z.number(),
  }),
) {}

type GarageRow = Awaited<ReturnType<GaragesService['get']>>;
const profile = (garage: GarageRow, role: GarageContext['role']) => ({
  id: garage.id,
  name: garage.name,
  city: garage.city,
  address: garage.address,
  lat: garage.lat,
  lng: garage.lng,
  status: garage.status,
  statusReason: garage.statusReason,
  role,
});

@ApiTags('garage')
@Controller('garage')
export class GaragesController {
  constructor(private readonly garages: GaragesService) {}

  /** A workshop owner creates their garage; it waits for approval (`pending`). */
  @Post()
  @SignedIn()
  @ApiCreatedResponse({ type: GarageDto })
  async create(@CurrentUser() user: SessionUser, @Body() body: CreateGarageDto) {
    return profile(await this.garages.create(user.id, body), 'owner');
  }

  /** The caller's garage: profile, status and the caller's role. */
  @Get('me')
  @GaragePermission('garage.view')
  @ApiOkResponse({ type: GarageDto })
  async me(@CurrentGarage() garage: GarageContext) {
    return profile(await this.garages.get(garage.garageId), garage.role);
  }

  @Patch('me')
  @GaragePermission('garage.edit')
  @ApiOkResponse({ type: GarageDto })
  async update(@CurrentGarage() garage: GarageContext, @Body() body: UpdateGarageDto) {
    return profile(await this.garages.update(garage.garageId, body), garage.role);
  }

  @Get('members')
  @GaragePermission('staff.manage')
  @ApiOkResponse({ type: MembersDto })
  members(@CurrentGarage() garage: GarageContext) {
    return this.garages.members(garage.garageId);
  }

  /** Adds a mechanic by phone; they sign in with a login code. At most 10 staff. */
  @Post('members')
  @GaragePermission('staff.manage')
  @ApiCreatedResponse({ type: MemberDto })
  addMember(
    @CurrentGarage() garage: GarageContext,
    @CurrentUser() user: SessionUser,
    @Body() body: AddMechanicDto,
  ) {
    return this.garages.addMechanic(garage.garageId, user.id, body.phone, body.name);
  }

  @Delete('members/:userId')
  @GaragePermission('staff.manage')
  @HttpCode(204)
  async removeMember(
    @CurrentGarage() garage: GarageContext,
    @CurrentUser() user: SessionUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    await this.garages.removeMember(garage.garageId, user.id, userId);
  }

  /** Owner only: jobs this week and month, earnings and reminders this month. */
  @Get('stats')
  @GaragePermission('earnings.view')
  @ApiOkResponse({ type: StatsDto })
  stats(@CurrentGarage() garage: GarageContext) {
    return this.garages.stats(garage.garageId);
  }
}
