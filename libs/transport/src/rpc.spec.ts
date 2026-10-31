import { ClientProxy, RpcException } from '@nestjs/microservices';
import { NEVER, throwError } from 'rxjs';
import { httpRequest, rpcRequest } from './rpc.js';

describe('limites de espera e falhas remotas', () => {
  afterEach(() => vi.useRealTimers());

  it('retorna 504 quando o gateway não recebe resposta', async () => {
    vi.useFakeTimers();
    const client = { send: () => NEVER } as unknown as ClientProxy;
    const assertion = expect(
      httpRequest(client, 'users.findAll', {}),
    ).rejects.toMatchObject({ response: { statusCode: 504 } });
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it('limita a espera de Orders por Users', async () => {
    vi.useFakeTimers();
    const client = { send: () => NEVER } as unknown as ClientProxy;
    const assertion = expect(
      rpcRequest(client, 'users.findOne', { id: 1 }),
    ).rejects.toMatchObject({ error: { statusCode: 504 } });
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
  });

  it('converte falha de conexão em erro RPC 503', async () => {
    const client = {
      send: () => throwError(() => new Error('ECONNREFUSED')),
    } as unknown as ClientProxy;
    try {
      await rpcRequest(client, 'users.findAll', {});
    } catch (error) {
      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toMatchObject({
        statusCode: 503,
      });
      return;
    }
    throw new Error('A chamada deveria falhar');
  });
});
