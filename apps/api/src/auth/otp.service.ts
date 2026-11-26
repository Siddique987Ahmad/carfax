import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { getConfig } from '../config';
import { AppError } from '../errors/app-error';
import { InjectMessaging, type MessageSender } from '../messaging/messaging.module';
import { REDIS } from '../redis/redis.module';

export const OTP_TTL_SECONDS = 5 * 60; // tech doc: codes expire in 5 minutes
export const OTP_MAX_ATTEMPTS = 5; // tech doc: max 5 tries
export const OTP_MAX_REQUESTS = 3; // per phone per window (api/03)
export const OTP_REQUEST_WINDOW_SECONDS = 15 * 60;

export type Audience = 'garage' | 'web';

// Counts the attempt and reads the stored hash in one step, so two requests at once can't both
// slip past the limit. A 6th attempt deletes the code.
const ATTEMPT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return {'missing'} end
local n = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
if n > tonumber(ARGV[1]) then
  redis.call('DEL', KEYS[1])
  return {'locked'}
end
return {'ok', redis.call('HGET', KEYS[1], 'hash'), tostring(tonumber(ARGV[1]) - n)}
`;

/**
 * Login codes (api/03). A code is never stored or logged in plain text: Redis keeps an HMAC keyed
 * with OTP_SECRET (a plain hash of a 6-digit code could be reversed by trying all million codes).
 */
@Injectable()
export class OtpService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @InjectMessaging() private readonly messaging: MessageSender,
  ) {}

  private key(audience: Audience, phone: string) {
    return `otp:${audience}:${phone}`;
  }

  private hash(audience: Audience, phone: string, code: string) {
    return createHmac('sha256', getConfig().OTP_SECRET)
      .update(`${audience}:${phone}:${code}`)
      .digest('hex');
  }

  /** Sends a new code (replacing any earlier one), at most 3 per phone per 15 minutes. */
  async request(phone: string, audience: Audience): Promise<{ expiresInSeconds: number }> {
    const limitKey = `otp-requests:${phone}`;
    const count = await this.redis.incr(limitKey);
    if (count === 1) await this.redis.expire(limitKey, OTP_REQUEST_WINDOW_SECONDS);
    if (count > OTP_MAX_REQUESTS) {
      const retryAfterSeconds = Math.max(await this.redis.ttl(limitKey), 1);
      throw new AppError('RATE_LIMITED', 429, 'Too many codes requested; try again later', {
        retryAfterSeconds,
      });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.redis
      .multi()
      .del(this.key(audience, phone))
      .hset(this.key(audience, phone), { hash: this.hash(audience, phone, code), attempts: 0 })
      .expire(this.key(audience, phone), OTP_TTL_SECONDS)
      .exec();
    await this.messaging.sendLoginCode(phone, code);
    return { expiresInSeconds: OTP_TTL_SECONDS };
  }

  /** Checks a code. Succeeds once: a used, expired or locked code is refused. */
  async verify(phone: string, audience: Audience, code: string): Promise<void> {
    const key = this.key(audience, phone);
    const result = (await this.redis.eval(ATTEMPT_SCRIPT, 1, key, OTP_MAX_ATTEMPTS)) as string[];
    if (result[0] === 'missing') {
      throw new AppError('OTP_EXPIRED', 400, 'No valid code for this phone; request a new one');
    }
    if (result[0] === 'locked') {
      throw new AppError('OTP_LOCKED', 400, 'Too many wrong tries; request a new code');
    }
    const stored = Buffer.from(result[1]!, 'hex');
    const given = Buffer.from(this.hash(audience, phone, code), 'hex');
    if (!timingSafeEqual(stored, given)) {
      throw new AppError('OTP_INVALID', 400, 'Wrong code', { attemptsLeft: Number(result[2]) });
    }
    // Single use: only the request that actually deletes the code wins.
    if ((await this.redis.del(key)) !== 1) {
      throw new AppError('OTP_EXPIRED', 400, 'This code was already used; request a new one');
    }
  }
}
