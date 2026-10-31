import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  CreateUserDto,
  UpdateUserDto,
  UserIdDto,
  type UserResponse,
} from '@app/contracts';
import { dtoPipe } from '../../../libs/transport/src/validation.js';
import { httpRequest } from '../../../libs/transport/src/rpc.js';
@Controller('users')
export class UsersController {
  constructor(@Inject('USERS_SERVICE') private readonly client: ClientProxy) {}
  @Post()
  create(@Body(dtoPipe(CreateUserDto)) dto: CreateUserDto) {
    return httpRequest<UserResponse>(this.client, 'users.create', dto);
  }
  @Get()
  findAll() {
    return httpRequest<UserResponse[]>(this.client, 'users.findAll', {});
  }

  @Get(':id')
  findOne(@Param(dtoPipe(UserIdDto)) dto: UserIdDto) {
    return httpRequest<UserResponse>(this.client, 'users.findOne', dto);
  }
  @Patch(':id')
  update(
    @Param(dtoPipe(UserIdDto)) dto: UserIdDto,
    @Body(dtoPipe(UpdateUserDto)) data: UpdateUserDto,
  ) {
    return httpRequest<UserResponse>(this.client, 'users.update', {
      id: dto.id,
      data,
    });
  }
  @Delete(':id')
  remove(@Param(dtoPipe(UserIdDto)) dto: UserIdDto) {
    return httpRequest<UserResponse>(this.client, 'users.remove', dto);
  }
}
