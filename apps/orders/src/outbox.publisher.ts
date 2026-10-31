import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from './prisma.service.js';
import { RabbitPublisher } from './rabbit.publisher.js';
import type { OutboxEvent } from '../../../generated/orders/client.js';

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RabbitPublisher) private readonly publisher: RabbitPublisher,
  ) {}

  @Cron('*/5 * * * * *', { waitForCompletion: true })
  async publishPendingEvents() {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          // The row locks also coordinate distinct Orders processes.
          const events = await tx.$queryRaw<OutboxEvent[]>`
          SELECT * FROM "OutboxEvent" WHERE "publishedAt" IS NULL
          ORDER BY "createdAt", "id" LIMIT 5 FOR UPDATE SKIP LOCKED
        `;
          for (const event of events) {
            try {
              await this.publisher.publish(event);
              await tx.outboxEvent.update({
                where: { id: event.id },
                data: { publishedAt: new Date() },
              });
              this.logger.log(`Evento ${event.id} confirmado pelo broker`);
            } catch {
              this.logger.warn(
                `Evento ${event.id} permanece pendente; nova tentativa no próximo ciclo`,
              );
              break;
            }
          }
        },
        { timeout: 60000, maxWait: 5000 },
      );
    } catch {
      this.logger.error(
        'Ciclo da Outbox falhou; eventos serão consultados novamente',
      );
    }
  }
}
