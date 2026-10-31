import { randomUUID } from 'node:crypto';
import { NotificationsService } from './notifications.service.js';
import type { PrismaService } from './prisma.service.js';

describe('idempotência de Notifications', () => {
  const tx = {
    processedEvent: { createMany: vi.fn() },
    notification: { create: vi.fn() },
  };
  const prisma = {
    $transaction: async (callback: (tx: unknown) => unknown) => callback(tx),
  };
  const service = new NotificationsService(prisma as unknown as PrismaService);
  const event = {
    eventId: randomUUID(),
    orderId: 1,
    userId: 1,
    total: '42.50',
    occurredAt: new Date().toISOString(),
  };
  beforeEach(() => vi.resetAllMocks());

  it('persiste efeito e registro do evento na mesma transação', async () => {
    tx.processedEvent.createMany.mockResolvedValue({ count: 1 });
    await expect(service.sendOrderNotification(event)).resolves.toMatchObject({
      duplicate: false,
    });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: { eventId: event.eventId, orderId: 1, userId: 1, total: '42.50' },
    });
  });

  it('não repete o efeito para um evento processado', async () => {
    tx.processedEvent.createMany.mockResolvedValue({ count: 0 });
    await expect(service.sendOrderNotification(event)).resolves.toMatchObject({
      duplicate: true,
    });
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('propaga falha na persistência para impedir ACK', async () => {
    tx.processedEvent.createMany.mockResolvedValue({ count: 1 });
    tx.notification.create.mockRejectedValue(new Error('database unavailable'));
    await expect(service.sendOrderNotification(event)).rejects.toThrow(
      'database unavailable',
    );
  });
});
