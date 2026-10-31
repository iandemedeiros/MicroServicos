import { RmqContext } from '@nestjs/microservices';
import { NotificationsController } from './notifications.controller.js';
import type { NotificationsService } from './notifications.service.js';
import { randomUUID } from 'node:crypto';

describe('ACK e DLQ de Notifications', () => {
  const event = {
    eventId: randomUUID(),
    orderId: 1,
    userId: 1,
    total: '4500.25',
    occurredAt: new Date().toISOString(),
  };
  const message = { content: Buffer.from('message') };
  const channel = { ack: vi.fn(), nack: vi.fn() };
  const service = { sendOrderNotification: vi.fn() };
  const context = new RmqContext([message, channel, 'order.created']);
  const controller = new NotificationsController(
    service as unknown as NotificationsService,
  );
  beforeEach(() => vi.resetAllMocks());

  it('confirma somente depois do processamento', async () => {
    service.sendOrderNotification.mockImplementation(async () => {
      expect(channel.ack).not.toHaveBeenCalled();
    });
    await controller.handleOrderCreated(event, context);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('rejeita falhas sem requeue imediato', async () => {
    service.sendOrderNotification.mockRejectedValue(new Error('unavailable'));
    await controller.handleOrderCreated(event, context);
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...event, eventId: 'invalid' },
    { ...event, total: 42 },
    { ...event, extra: true },
  ])('envia evento inválido para DLQ (%j)', async (payload) => {
    await controller.handleOrderCreated(payload, context);
    expect(service.sendOrderNotification).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });
});
