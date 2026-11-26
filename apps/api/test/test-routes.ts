// Test-only routes for checking the API's global behaviour (errors, validation, logging).
// Never imported by the real app.
import { PakistanMobileSchema } from '@carfax/shared';
import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AppError } from '../src/errors/app-error';

class SignUpDto extends createZodDto(
  z.object({ phone: PakistanMobileSchema, name: z.string().min(2) }),
) {}

@Controller('test')
class TestRoutesController {
  @Post('sign-up')
  signUp(@Body() body: SignUpDto) {
    return { ok: true, phone: body.phone };
  }

  @Get('conflict')
  conflict() {
    throw new AppError('CONFLICT', 409, 'That garage already exists', { field: 'name' });
  }

  @Get('crash')
  crash(@Query('phone') _phone?: string) {
    // As a Postgres duplicate-key error would read.
    throw new Error('Key (phone)=(+923451112233) already exists');
  }
}

@Module({ controllers: [TestRoutesController] })
export class TestRoutesModule {}
