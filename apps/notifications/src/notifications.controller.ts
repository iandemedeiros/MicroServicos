import { Controller, Inject, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrderCreatedEvent } from '@app/contracts';
import { NotificationsService } from './notifications.service.js';

@Controller()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);
  constructor(
    @Inject(NotificationsService)
    private readonly service: NotificationsService,
  ) {}

  @EventPattern<string>('order.created')
  async handleOrderCreated(
    @Payload() data: unknown,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;
    try {
      if (typeof data !== 'object' || data === null || Array.isArray(data))
        throw new Error('Evento inválido');
      const event = plainToInstance(OrderCreatedEvent, data);
      const errors = await validate(event, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (errors.length) throw new Error('Evento inválido');
      await this.service.sendOrderNotification(event);
    } catch {
      // No immediate requeue: failures remain inspectable in the DLQ.
      channel.nack(message, false, false);
      this.logger.warn('Evento rejeitado e encaminhado para a DLQ');
      return;
    }
    channel.ack(message);
  }
}
