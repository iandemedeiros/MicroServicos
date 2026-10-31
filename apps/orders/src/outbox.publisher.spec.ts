import { OutboxPublisher } from './outbox.publisher.js';
import type { PrismaService } from './prisma.service.js';
import type { RabbitPublisher } from './rabbit.publisher.js';

describe('Outbox e confirmação de publicação', () => {
  const event = {
    id: 'stable-event-id',
    eventType: 'order.created',
    payload: { orderId: 1 },
  };
  const tx = { $queryRaw: vi.fn(), outboxEvent: { update: vi.fn() } };
  const prisma = {
    $transaction: async (callback: (tx: unknown) => unknown) => callback(tx),
  };
  const broker = { publish: vi.fn() };
  const publisher = new OutboxPublisher(
    prisma as unknown as PrismaService,
    broker as unknown as RabbitPublisher,
  );
  beforeEach(() => {
    vi.resetAllMocks();
    tx.$queryRaw.mockResolvedValue([event]);
  });

  it('só marca publicação depois da confirmação', async () => {
    broker.publish.mockImplementation(async () => {
      expect(tx.outboxEvent.update).not.toHaveBeenCalled();
    });
    await publisher.publishPendingEvents();
    expect(broker.publish).toHaveBeenCalledWith(event);
    expect(tx.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: event.id },
      data: { publishedAt: expect.any(Date) },
    });
  });

  it('mantém o evento pendente quando o broker falha, reutilizando o eventId', async () => {
    broker.publish.mockRejectedValueOnce(new Error('broker unavailable'));
    await publisher.publishPendingEvents();
    expect(tx.outboxEvent.update).not.toHaveBeenCalled();
    broker.publish.mockResolvedValueOnce(undefined);
    await publisher.publishPendingEvents();
    expect(broker.publish.mock.calls.map(([value]) => value.id)).toEqual([
      event.id,
      event.id,
    ]);
    expect(tx.outboxEvent.update).toHaveBeenCalledTimes(1);
  });
});
