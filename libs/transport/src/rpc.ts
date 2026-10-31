import { Catch, HttpException, type RpcExceptionFilter } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom, throwError, timeout, TimeoutError } from 'rxjs';
import type { RpcError } from '../../contracts/src/index.js';

export function remoteError(error: unknown): RpcError {
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    'message' in error
  ) {
    const candidate = error as RpcError;
    if (
      [400, 404, 409, 500, 503, 504].includes(candidate.statusCode) &&
      (typeof candidate.message === 'string' ||
        (Array.isArray(candidate.message) &&
          candidate.message.every((m) => typeof m === 'string')))
    )
      return candidate;
  }
  if (error instanceof TimeoutError)
    return {
      statusCode: 504,
      message: 'Tempo de resposta do serviço excedido',
    };
  return { statusCode: 503, message: 'Serviço indisponível' };
}

export async function rpcRequest<T>(
  client: ClientProxy,
  pattern: string,
  payload: unknown,
  wait = 3000,
): Promise<T> {
  try {
    return await firstValueFrom(
      client.send<T>(pattern, payload).pipe(timeout(wait)),
    );
  } catch (error) {
    throw new RpcException(remoteError(error));
  }
}

export async function httpRequest<T>(
  client: ClientProxy,
  pattern: string,
  payload: unknown,
): Promise<T> {
  try {
    return await firstValueFrom(
      client.send<T>(pattern, payload).pipe(timeout(5000)),
    );
  } catch (error) {
    const result = remoteError(error);
    throw new HttpException(result, result.statusCode);
  }
}

@Catch()
export class RpcErrorsFilter implements RpcExceptionFilter {
  catch(exception: unknown) {
    if (exception instanceof RpcException)
      return throwError(() => exception.getError());
    const code =
      typeof exception === 'object' && exception !== null && 'code' in exception
        ? exception.code
        : undefined;
    if (code === 'P2002')
      return throwError(() => ({
        statusCode: 409,
        message: 'Registro já existe',
      }));
    if (code === 'P2025')
      return throwError(() => ({
        statusCode: 404,
        message: 'Registro não encontrado',
      }));
    return throwError(() => ({
      statusCode: 500,
      message: 'Erro interno do serviço',
    }));
  }
}
