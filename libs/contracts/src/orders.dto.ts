import {
  IsDefined,
  IsInt,
  IsNumber,
  ValidateIf,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @IsInt() @Min(1) userId: number;
  @IsString() @MinLength(3) description: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(99999999.99) total: number;
}
export class UpdateOrderDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  userId?: number;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(3)
  description?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  total?: number;
}
export class OrderIdDto {
  @Type(() => Number) @IsInt() @Min(1) id: number;
}
export class OrdersByUserDto {
  @Type(() => Number) @IsInt() @Min(1) userId: number;
}
export class UpdateOrderMessage extends OrderIdDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateOrderDto)
  data: UpdateOrderDto;
}
