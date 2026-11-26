import { PakistanMobileSchema } from '@carfax/shared';
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { getConfig } from '../config';
import { AppError } from '../errors/app-error';
import { CurrentUser, Public, SignedIn } from '../access/access.decorators';
import { AuthService } from './auth.service';
import type { Audience } from './otp.service';
import { REFRESH_TOKEN_DAYS, type SessionUser } from './token.service';

const AudienceSchema = z
  .enum(['garage', 'web'])
  .describe('garage: the mobile app; web: the public website');

class RequestCodeDto extends createZodDto(
  z.object({ phone: PakistanMobileSchema, audience: AudienceSchema }),
) {}
class VerifyCodeDto extends createZodDto(
  z.object({
    phone: PakistanMobileSchema,
    audience: AudienceSchema,
    code: z.string().regex(/^\d{6}$/, 'Six digits'),
  }),
) {}
class RefreshDto extends createZodDto(
  z.object({
    refreshToken: z.string().min(20).optional().describe('Garage app; the website uses the cookie'),
  }),
) {}

const SessionUserSchema = z.object({
  id: z.uuid(),
  audience: AudienceSchema,
  roles: z.array(z.string()),
  garages: z.array(z.object({ garageId: z.uuid(), role: z.string() })),
});
class CodeSentDto extends createZodDto(
  z.object({ sent: z.literal(true), expiresInSeconds: z.number() }),
) {}
class SignedInDto extends createZodDto(
  z.object({
    accessToken: z.string(),
    refreshToken: z
      .string()
      .optional()
      .describe('Garage app only; the website gets an httpOnly cookie'),
    expiresIn: z.number().describe('Seconds until the access token expires'),
    user: SessionUserSchema.optional(),
  }),
) {}
class MeDto extends createZodDto(
  z.object({
    id: z.uuid(),
    phone: z.string(),
    name: z.string().nullable(),
    roles: z.array(z.string()),
    garages: z.array(z.object({ garageId: z.uuid(), role: z.string() })),
  }),
) {}

/** The website keeps its refresh token in this httpOnly cookie, out of reach of page scripts. */
export const REFRESH_COOKIE = 'carfax_refresh';

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: getConfig().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/v1/auth',
    maxAge: REFRESH_TOKEN_DAYS * 86_400_000,
  });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Sends a 6-digit code to the phone (WhatsApp first, SMS fallback). At most 3 per 15 minutes. */
  @Post('otp/request')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({ type: CodeSentDto })
  async requestCode(@Body() body: RequestCodeDto) {
    const { expiresInSeconds } = await this.auth.requestCode(body.phone, body.audience);
    return { sent: true as const, expiresInSeconds };
  }

  /** Checks the code and signs in, creating the user on first login. */
  @Post('otp/verify')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({ type: SignedInDto })
  async verifyCode(@Body() body: VerifyCodeDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, expiresIn, user } = await this.auth.verifyCode(
      body.phone,
      body.audience,
      body.code,
    );
    return this.respond(res, body.audience, { accessToken, refreshToken, expiresIn, user });
  }

  /** New tokens for an old refresh token (body for the app, cookie for the website). Rotates it. */
  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({ type: SignedInDto })
  async refresh(
    @Body() body: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = body.refreshToken ?? readCookie(req, REFRESH_COOKIE);
    if (!token) throw new AppError('UNAUTHORIZED', 401, 'Sign in again', { reason: 'missing' });
    const { audience, ...tokens } = await this.auth.refresh(token);
    return this.respond(res, audience, tokens);
  }

  /** Signs out this device: every token from this login stops working. */
  @Post('logout')
  @Public()
  @HttpCode(204)
  async logout(
    @Body() body: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = body.refreshToken ?? readCookie(req, REFRESH_COOKIE);
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
  }

  /** The signed-in user. */
  @Get('me')
  @SignedIn()
  @ApiOkResponse({ type: MeDto })
  me(@CurrentUser() user: SessionUser) {
    return this.auth.me(user);
  }

  private respond(
    res: Response,
    audience: Audience,
    tokens: { accessToken: string; refreshToken: string; expiresIn: number; user?: SessionUser },
  ) {
    if (audience === 'web') {
      setRefreshCookie(res, tokens.refreshToken);
      const { refreshToken: _, ...rest } = tokens;
      return rest;
    }
    return tokens;
  }
}
