import { type Db, schema, withSystem } from '@carfax/db';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB } from '../db/db.module';
import { AppError } from '../errors/app-error';
import { type Audience, OtpService } from './otp.service';
import { type IssuedTokens, type SessionUser, TokenService } from './token.service';

/** Ties login codes, users and tokens together (api/03). */
@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  requestCode(phone: string, audience: Audience) {
    return this.otp.request(phone, audience);
  }

  /**
   * Checks the code, then signs the person in. A new phone becomes a new user: on the website as a
   * buyer; in the garage app with no role yet (garage membership comes from api/05).
   */
  async verifyCode(
    phone: string,
    audience: Audience,
    code: string,
  ): Promise<IssuedTokens & { user: SessionUser }> {
    await this.otp.verify(phone, audience, code);

    const userId = await withSystem(this.db, async (tx) => {
      const [existing] = await tx.select().from(schema.users).where(eq(schema.users.phone, phone));
      if (existing) {
        await tx
          .update(schema.users)
          .set({ lastLoginAt: new Date() })
          .where(eq(schema.users.id, existing.id));
        return existing.id;
      }
      const [created] = await tx
        .insert(schema.users)
        .values({ phone, lastLoginAt: new Date() })
        .onConflictDoNothing({ target: schema.users.phone })
        .returning();
      // Two first logins at once: the other one created the user.
      const id =
        created?.id ??
        (await tx.select().from(schema.users).where(eq(schema.users.phone, phone)))[0]!.id;
      if (audience === 'web') {
        await tx
          .insert(schema.userRoles)
          .values({ userId: id, role: 'buyer' })
          .onConflictDoNothing();
      }
      return id;
    });

    const user = await this.tokens.loadSessionUser(userId, audience);
    if (!user.isActive) throw new AppError('FORBIDDEN', 403, 'This account is disabled');
    const { isActive: _, ...session } = user;
    return { ...(await this.tokens.issue(session)), user: session };
  }

  refresh(token: string) {
    return this.tokens.refresh(token);
  }

  logout(token: string) {
    return this.tokens.revokeFamilyOf(token);
  }

  async me(sessionUser: SessionUser) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, sessionUser.id));
    if (!user) throw new AppError('UNAUTHORIZED', 401, 'Sign in again');
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      roles: sessionUser.roles,
      garages: sessionUser.garages,
    };
  }
}
