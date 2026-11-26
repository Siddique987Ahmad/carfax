import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { type Db, schema, withSystem } from '@carfax/db';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { getConfig } from '../config';
import { DB } from '../db/db.module';
import { AppError } from '../errors/app-error';
import type { Audience } from './otp.service';

export const ACCESS_TOKEN_SECONDS = 15 * 60; // tech doc: 15 minutes
export const REFRESH_TOKEN_DAYS = 30; // tech doc: 30 days, renewed on each use
/** A retry within this time after a rotation (response lost on a bad network) isn't treated as theft. */
export const REFRESH_RETRY_GRACE_SECONDS = 60;
const ISSUER = 'carfax-api';

export interface SessionUser {
  id: string;
  audience: Audience;
  /** Platform roles (user_roles, db/02). */
  roles: string[];
  /** Garage memberships (garage_members, db/03). */
  garages: { garageId: string; role: string }[];
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const secretKey = () => new TextEncoder().encode(getConfig().JWT_SECRET);

/**
 * Access tokens (signed JWT, 15 minutes) and refresh tokens (random, stored hashed, rotated on every
 * use). Reusing an old refresh token after the retry grace period revokes its whole family: every
 * device signed in with that login is signed out (api/03).
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger('Auth');

  constructor(@Inject(DB) private readonly db: Db) {}

  /** Roles and garages are read fresh on every token, so changes apply within 15 minutes. */
  async loadSessionUser(
    userId: string,
    audience: Audience,
  ): Promise<SessionUser & { isActive: boolean }> {
    return withSystem(this.db, async (tx) => {
      const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, userId));
      if (!user) throw new AppError('UNAUTHORIZED', 401, 'Sign in again');
      const roles = await tx
        .select()
        .from(schema.userRoles)
        .where(eq(schema.userRoles.userId, userId));
      const garages = await tx
        .select()
        .from(schema.garageMembers)
        .where(eq(schema.garageMembers.userId, userId));
      return {
        id: user.id,
        audience,
        isActive: user.isActive,
        roles: roles.map((r) => r.role).sort(),
        garages: garages.map((g) => ({ garageId: g.garageId, role: g.role })),
      };
    });
  }

  private async signAccess(user: SessionUser): Promise<string> {
    return new SignJWT({ roles: user.roles, garages: user.garages })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setAudience(user.audience)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
      .sign(secretKey());
  }

  async verifyAccess(token: string): Promise<SessionUser> {
    try {
      const { payload } = await jwtVerify(token, secretKey(), {
        issuer: ISSUER,
        audience: ['garage', 'web'],
        algorithms: ['HS256'],
      });
      return {
        id: String(payload.sub),
        audience: (Array.isArray(payload.aud) ? payload.aud[0] : payload.aud) as Audience,
        roles: (payload.roles as string[]) ?? [],
        garages: (payload.garages as SessionUser['garages']) ?? [],
      };
    } catch (error) {
      const expired = (error as { code?: string }).code === 'ERR_JWT_EXPIRED';
      throw new AppError(
        'UNAUTHORIZED',
        401,
        expired ? 'Access token expired; refresh it' : 'Sign in again',
        {
          reason: expired ? 'expired' : 'invalid',
        },
      );
    }
  }

  private async insertRefresh(
    tx: Parameters<Parameters<Db['transaction']>[0]>[0],
    userId: string,
    audience: Audience,
    familyId: string,
  ): Promise<{ id: string; token: string }> {
    const token = randomBytes(32).toString('base64url');
    const [row] = await tx
      .insert(schema.refreshTokens)
      .values({
        userId,
        familyId,
        audience,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 86_400_000),
      })
      .returning({ id: schema.refreshTokens.id });
    return { id: row!.id, token };
  }

  /** A new login: a new token family. */
  async issue(user: SessionUser): Promise<IssuedTokens> {
    const refresh = await this.db.transaction((tx) =>
      this.insertRefresh(tx, user.id, user.audience, randomUUID()),
    );
    return {
      accessToken: await this.signAccess(user),
      refreshToken: refresh.token,
      expiresIn: ACCESS_TOKEN_SECONDS,
    };
  }

  /** Exchanges a refresh token for new tokens, rotating it. */
  async refresh(token: string): Promise<IssuedTokens & { audience: Audience }> {
    const now = new Date();
    const result = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(schema.refreshTokens)
        .where(eq(schema.refreshTokens.tokenHash, sha256(token)))
        .for('update');
      if (!current || current.expiresAt <= now) return { outcome: 'invalid' as const };

      if (current.revokedAt) {
        // A retry of a rotation whose response was lost: allowed once, briefly, if the replacement
        // was never used. The unused replacement is cancelled and a fresh one issued.
        const recent =
          now.getTime() - current.revokedAt.getTime() <= REFRESH_RETRY_GRACE_SECONDS * 1000;
        if (recent && current.replacedById) {
          const [next] = await tx
            .select()
            .from(schema.refreshTokens)
            .where(eq(schema.refreshTokens.id, current.replacedById))
            .for('update');
          if (next && !next.usedAt && !next.revokedAt) {
            const fresh = await this.insertRefresh(
              tx,
              current.userId,
              current.audience,
              current.familyId,
            );
            await tx
              .update(schema.refreshTokens)
              .set({ revokedAt: now })
              .where(eq(schema.refreshTokens.id, next.id));
            await tx
              .update(schema.refreshTokens)
              .set({ replacedById: fresh.id })
              .where(eq(schema.refreshTokens.id, current.id));
            return {
              outcome: 'ok' as const,
              userId: current.userId,
              audience: current.audience,
              token: fresh.token,
            };
          }
        }
        // Otherwise an old token came back: it was copied. Sign out the whole family.
        await tx
          .update(schema.refreshTokens)
          .set({ revokedAt: now })
          .where(
            and(
              eq(schema.refreshTokens.familyId, current.familyId),
              isNull(schema.refreshTokens.revokedAt),
            ),
          );
        return { outcome: 'reused' as const, userId: current.userId, familyId: current.familyId };
      }

      const fresh = await this.insertRefresh(
        tx,
        current.userId,
        current.audience,
        current.familyId,
      );
      await tx
        .update(schema.refreshTokens)
        .set({ revokedAt: now, usedAt: now, replacedById: fresh.id })
        .where(eq(schema.refreshTokens.id, current.id));
      return {
        outcome: 'ok' as const,
        userId: current.userId,
        audience: current.audience,
        token: fresh.token,
      };
    });

    if (result.outcome === 'reused') {
      this.logger.warn(
        { userId: result.userId, familyId: result.familyId },
        'refresh token reused: session family revoked',
      );
    }
    if (result.outcome !== 'ok') throw new AppError('UNAUTHORIZED', 401, 'Sign in again');

    const user = await this.loadSessionUser(result.userId, result.audience);
    if (!user.isActive) {
      await this.revokeFamilyOf(result.token);
      throw new AppError('FORBIDDEN', 403, 'This account is disabled');
    }
    return {
      accessToken: await this.signAccess(user),
      refreshToken: result.token,
      expiresIn: ACCESS_TOKEN_SECONDS,
      audience: user.audience,
    };
  }

  /** Signs out the device: revokes the token's whole family. Unknown tokens are ignored. */
  async revokeFamilyOf(token: string): Promise<void> {
    const [row] = await this.db
      .select({ familyId: schema.refreshTokens.familyId })
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.tokenHash, sha256(token)));
    if (!row) return;
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.refreshTokens.familyId, row.familyId),
          isNull(schema.refreshTokens.revokedAt),
        ),
      );
  }
}
