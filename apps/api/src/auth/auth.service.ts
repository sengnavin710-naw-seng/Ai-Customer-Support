import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Session, User } from '@support/contracts';
import { ENV } from '../config';
import type { Environment } from '../config';
const derive = promisify(scrypt);
export const SESSION_TTL_MS = 30 * 60 * 1000;
@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, { user: User; expires: number }>();
  constructor(@Inject(ENV) private readonly env: Environment) {}
  async login(email: string, password: string): Promise<Session> {
    const [salt, stored] = this.env.DEV_ADMIN_PASSWORD_HASH.split(':') as [string, string];
    const candidate = (await derive(password, salt, 64)) as Buffer;
    const validPassword = timingSafeEqual(candidate, Buffer.from(stored, 'hex'));
    if (email.toLowerCase() !== this.env.DEV_ADMIN_EMAIL.toLowerCase() || !validPassword)
      throw new UnauthorizedException('Invalid email or password');
    this.prune();
    // Bound development session storage, including repeated valid logins.
    if (this.sessions.size >= 100) {
      const first = this.sessions.keys().next().value;
      if (first) this.sessions.delete(first);
    }
    const user: User = {
      id: 'dev-admin',
      name: 'Workspace admin',
      email: this.env.DEV_ADMIN_EMAIL,
      role: 'admin',
    };
    const accessToken = randomBytes(32).toString('base64url');
    const expires = Date.now() + SESSION_TTL_MS;
    this.sessions.set(this.digest(accessToken), { user, expires });
    return { accessToken, user, expiresAt: new Date(expires).toISOString() };
  }
  authenticate(token: string): User {
    const session = this.sessions.get(this.digest(token));
    if (!session || session.expires <= Date.now()) {
      this.sessions.delete(this.digest(token));
      throw new UnauthorizedException('Session expired or invalid');
    }
    return session.user;
  }
  logout(token: string): void {
    this.sessions.delete(this.digest(token));
  }
  private digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  private prune(): void {
    for (const [key, value] of this.sessions)
      if (value.expires <= Date.now()) this.sessions.delete(key);
  }
}
