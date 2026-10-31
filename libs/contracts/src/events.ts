import { IsDateString, IsInt, IsUUID, Matches, Min } from 'class-validator';

export class OrderCreatedEvent {
  @IsUUID() eventId: string;
  @IsInt() @Min(1) orderId: number;
  @IsInt() @Min(1) userId: number;
  @Matches(/^\d+(\.\d{1,2})?$/) total: string;
  @IsDateString() occurredAt: string;
}
