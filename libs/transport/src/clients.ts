import { Transport, type TcpClientOptions } from '@nestjs/microservices';
export function tcpClient(
  domain: 'USERS' | 'ORDERS',
): TcpClientOptions & { name: string } {
  return {
    name: domain + '_SERVICE',
    transport: Transport.TCP,
    options: {
      host: process.env[domain + '_HOST'] ?? '127.0.0.1',
      port: Number(
        process.env[domain + '_PORT'] ?? (domain === 'USERS' ? 3001 : 3002),
      ),
    },
  };
}
