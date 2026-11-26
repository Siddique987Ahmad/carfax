import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { getConfig } from '../config';

/** Delivers messages to a phone. WhatsApp and SMS providers come with workers/04 (packages/messaging). */
export interface MessageSender {
  sendLoginCode(phone: string, code: string): Promise<void>;
}

export const MESSAGING = Symbol('MESSAGING');
export const InjectMessaging = () => Inject(MESSAGING);

/**
 * Local development only: prints the login code to the terminal, so you can sign in without
 * WhatsApp. Written straight to the terminal, never through the logger, and refused in production.
 */
@Injectable()
export class ConsoleSender implements MessageSender {
  async sendLoginCode(phone: string, code: string) {
    process.stdout.write(`\n  Login code for ${phone}: ${code}   (MESSAGING_PROVIDER=console)\n\n`);
  }
}

/** Tests: keeps the last code per phone so the test can sign in (api/02 harness, asUser). */
@Injectable()
export class MemorySender implements MessageSender {
  private readonly codes = new Map<string, string>();
  async sendLoginCode(phone: string, code: string) {
    this.codes.set(phone, code);
  }
  lastCode(phone: string): string | undefined {
    return this.codes.get(phone);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: MESSAGING,
      useFactory: (): MessageSender =>
        getConfig().MESSAGING_PROVIDER === 'memory' ? new MemorySender() : new ConsoleSender(),
    },
  ],
  exports: [MESSAGING],
})
export class MessagingModule {}
