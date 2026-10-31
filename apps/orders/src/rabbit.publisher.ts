import { Injectable } from '@nestjs/common';
import { connect } from 'amqplib';
import { rabbitConfig } from '../../../libs/transport/src/rabbitmq.js';
import { setupRabbitmq } from '../../../libs/transport/src/rabbitmq-topology.js';

@Injectable()
export class RabbitPublisher {
  async publish(event: { id: string; eventType: string; payload: unknown }) {
    const config = rabbitConfig();
    const connection = await connect(config.url, { timeout: 5000 });
    connection.on('error', () => {}); // Pending operations reject on connection loss.
    try {
      const channel = await connection.createConfirmChannel();
      channel.on('error', () => {});
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await setupRabbitmq(channel);
        let returned = false;
        channel.on('return', () => {
          returned = true;
        });
        await Promise.race([
          new Promise<void>((resolve, reject) => {
            // Nest's RMQ event envelope, without a request/reply id.
            channel.sendToQueue(
              config.queue,
              Buffer.from(
                JSON.stringify({
                  pattern: event.eventType,
                  data: event.payload,
                }),
              ),
              {
                persistent: true,
                mandatory: true,
                messageId: event.id,
                contentType: 'application/json',
                type: event.eventType,
              },
              (error) => {
                if (error) reject(error);
                else if (returned) reject(new Error('Evento não roteado'));
                else resolve();
              },
            );
          }),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
              () => reject(new Error('Confirmação AMQP excedeu o prazo')),
              5000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
        await channel.close().catch(() => {});
      }
    } finally {
      await connection.close().catch(() => {});
    }
  }
}
