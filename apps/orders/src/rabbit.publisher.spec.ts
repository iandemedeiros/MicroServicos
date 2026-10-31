import { connect } from 'amqplib';
import { RabbitPublisher } from './rabbit.publisher.js';

vi.mock('amqplib', () => ({ connect: vi.fn() }));

describe('publisher confirms AMQP', () => {
  const event = {
    id: 'event-id',
    eventType: 'order.created',
    payload: { orderId: 1 },
  };
  let confirm: (error: Error | null) => void;
  let returned: () => void;
  const channel = {
    on: vi.fn((name: string, callback: () => void) => {
      if (name === 'return') returned = callback;
    }),
    assertExchange: vi.fn(),
    assertQueue: vi.fn(),
    bindQueue: vi.fn(),
    sendToQueue: vi.fn((_queue, _content, _options, callback) => {
      confirm = callback;
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const connection = {
    on: vi.fn(),
    createConfirmChannel: vi.fn().mockResolvedValue(channel),
    close: vi.fn().mockResolvedValue(undefined),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(connect).mockResolvedValue(connection as never);
  });
  afterEach(() => vi.useRealTimers());

  it('aguarda confirmação e envia evento persistente e obrigatório', async () => {
    const pending = new RabbitPublisher().publish(event);
    await vi.waitFor(() => expect(channel.sendToQueue).toHaveBeenCalled());
    expect(connection.close).not.toHaveBeenCalled();
    const [queue, content, options] = channel.sendToQueue.mock.calls[0];
    expect(queue).toBeTruthy();
    expect(JSON.parse(content.toString())).toEqual({
      pattern: event.eventType,
      data: event.payload,
    });
    expect(options).toMatchObject({
      persistent: true,
      mandatory: true,
      messageId: event.id,
    });
    confirm(null);
    await pending;
    expect(connection.close).toHaveBeenCalled();
  });

  it('rejeita uma mensagem devolvida mesmo quando o broker confirma o publish', async () => {
    const pending = new RabbitPublisher().publish(event);
    const assertion = expect(pending).rejects.toThrow('Evento não roteado');
    await vi.waitFor(() => expect(channel.sendToQueue).toHaveBeenCalled());
    returned();
    confirm(null);
    await assertion;
  });

  it('fecha o canal quando o broker não confirma dentro do prazo', async () => {
    vi.useFakeTimers();
    const pending = new RabbitPublisher().publish(event);
    const assertion = expect(pending).rejects.toThrow(
      'Confirmação AMQP excedeu o prazo',
    );
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(channel.close).toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
  });
});
