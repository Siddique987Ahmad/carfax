import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentGarage, type GarageContext, GaragePermission } from '../access/access.decorators';
import { RemindersService } from './reminders.service';

class DueQueryDto extends createZodDto(
  z.object({
    within: z.coerce
      .number()
      .int()
      .min(0)
      .max(60)
      .default(7)
      .describe('Days ahead to include (overdue ones always are)'),
  }),
) {}
class SendReminderDto extends createZodDto(
  z.object({ language: z.enum(['en', 'ur']).default('en') }),
) {}
class UpdateReminderDto extends createZodDto(
  z.object({
    action: z.enum(['snooze', 'cancel']),
    /** For snooze: how many days to move the due date (from today, if it's already due). */
    days: z.number().int().min(1).max(60).default(7),
  }),
) {}

class DueRemindersDto extends createZodDto(
  z.array(
    z.object({
      id: z.uuid(),
      kind: z.string(),
      dueDate: z.iso.date(),
      carId: z.uuid(),
      sourceJobId: z.uuid().nullable(),
      customerId: z.uuid().nullable(),
      customerName: z.string().nullable(),
      customerPhone: z.string().nullable(),
      regNo: z.string().nullable(),
      make: z.string().nullable(),
      model: z.string().nullable(),
      lastVisit: z.iso.date().nullable(),
    }),
  ),
) {}
class SentReminderDto extends createZodDto(
  z.object({ method: z.literal('wa_me'), shareLink: z.string(), text: z.string() }),
) {}
class UpdatedReminderDto extends createZodDto(
  z.object({ id: z.uuid(), status: z.string(), dueDate: z.iso.date() }),
) {}

@ApiTags('reminders')
@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  /** Reminders to send: not sent yet and due within `within` days, overdue ones included. */
  @Get('due')
  @GaragePermission('reminders.send')
  @ApiOkResponse({ type: DueRemindersDto })
  due(@Query() query: DueQueryDto, @CurrentGarage() garage: GarageContext) {
    return this.reminders.due(garage, query.within);
  }

  /** One tap (pilot): a wa.me link with the reminder typed in; marks it sent. */
  @Post(':id/send')
  @HttpCode(200)
  @GaragePermission('reminders.send')
  @ApiOkResponse({ type: SentReminderDto })
  send(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SendReminderDto,
    @CurrentGarage() garage: GarageContext,
  ) {
    return this.reminders.send(garage, id, body.language);
  }

  /** Snooze (move the due date by `days`) or cancel a reminder that hasn't been sent. */
  @Patch(':id')
  @GaragePermission('reminders.send')
  @ApiOkResponse({ type: UpdatedReminderDto })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateReminderDto,
    @CurrentGarage() garage: GarageContext,
  ) {
    return this.reminders.update(
      garage,
      id,
      body.action === 'snooze' ? { action: 'snooze', days: body.days } : { action: 'cancel' },
    );
  }
}
