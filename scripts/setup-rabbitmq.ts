import 'dotenv/config';
import { connect } from 'amqplib';
import { rabbitConfig } from '../libs/transport/src/rabbitmq.js';
import { setupRabbitmq } from '../libs/transport/src/rabbitmq-topology.js';

const connection = await connect(rabbitConfig().url, { timeout: 5000 });
try {
  const channel = await connection.createChannel();
  try {
    await setupRabbitmq(channel);
    console.log('Filas e DLQ configuradas');
  } finally {
    await channel.close();
  }
} finally {
  await connection.close();
}
