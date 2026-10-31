import {
  IsDefined,
  IsEmail,
  IsInt,
  ValidateIf,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString() @MinLength(3) name: string;
  @IsEmail() email: string;
}
export class UpdateUserDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(3)
  name?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEmail()
  email?: string;
}
export class UserIdDto {
  @Type(() => Number) @IsInt() @Min(1) id: number;
}
export class UpdateUserMessage extends UserIdDto {
  @IsDefined() @ValidateNested() @Type(() => UpdateUserDto) data: UpdateUserDto;
}
