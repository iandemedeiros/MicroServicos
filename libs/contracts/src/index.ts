export * from './users.dto.js';
export * from './orders.dto.js';
export * from './events.js';

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}
export interface OrderResponse {
  id: number;
  userId: number;
  description: string;
  total: string;
  createdAt: string;
}
export interface RpcError {
  statusCode: number;
  message: string | string[];
}
