import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CurrentGarage,
  CurrentUser,
  type GarageContext,
  GaragePermission,
  Public,
} from '../access/access.decorators';
import type { SessionUser } from '../auth/token.service';
import { BillsService } from './bills.service';

class SendBillDto extends createZodDto(
  z.object({
    language: z.enum(['en', 'ur']).default('en').describe('Language of the WhatsApp message'),
  }),
) {}
class SentBillDto extends createZodDto(
  z.object({
    method: z.literal('wa_me'),
    /** Open this: WhatsApp starts a chat with the customer, the bill already typed. */
    shareLink: z.string(),
    billUrl: z.string(),
    text: z.string(),
    sendsToday: z.number(),
  }),
) {}
class BillPageDto extends createZodDto(
  z.object({
    garage: z.object({ name: z.string(), city: z.string(), address: z.string().nullable() }),
    car: z.object({
      make: z.string().nullable(),
      model: z.string().nullable(),
      year: z.number().nullable(),
      regNo: z.string().nullable(),
    }),
    serviceDate: z.iso.date(),
    odometerKm: z.number().nullable(),
    items: z.array(
      z.object({
        workType: z.string(),
        description: z.string().nullable(),
        partName: z.string().nullable(),
        partPricePkr: z.number().nullable(),
        labourPricePkr: z.number().nullable(),
      }),
    ),
    totalPkr: z.number(),
    nextServiceDueDate: z.iso.date().nullable(),
    notice: z.string(),
  }),
) {}

@ApiTags('bills')
@Controller()
export class BillsController {
  constructor(private readonly bills: BillsService) {}

  /**
   * A WhatsApp link that opens a chat with the customer with the bill typed in, plus a link to the
   * bill page (pilot: sent with one tap from the garage's own WhatsApp). At most 3 per job per day.
   */
  @Post('jobs/:id/send-bill')
  @HttpCode(200)
  @GaragePermission('bills.send')
  @ApiOkResponse({ type: SentBillDto })
  send(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SendBillDto,
    @CurrentGarage() garage: GarageContext,
    @CurrentUser() user: SessionUser,
  ) {
    return this.bills.send(garage, user.id, id, body.language);
  }

  /** The bill page's data, for anyone with the link (the website renders it, web plans). */
  @Get('bills/:token')
  @Public()
  @ApiOkResponse({ type: BillPageDto })
  page(@Param('token') token: string) {
    return this.bills.byToken(token);
  }
}
