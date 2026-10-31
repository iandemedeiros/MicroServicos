import { Controller, Inject, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateUserDto, UpdateUserMessage, UserIdDto } from '@app/contracts';
import { dtoPipe } from '../../../libs/transport/src/validation.js';
import { RpcErrorsFilter } from '../../../libs/transport/src/rpc.js';
import { UsersService } from './users.service.js';
@Controller()
@UseFilters(RpcErrorsFilter)
export class UsersController {
  constructor(@Inject(UsersService) private readonly service: UsersService) {}
  @MessagePattern('users.create')
  create(@Payload(dtoPipe(CreateUserDto, true)) dto: CreateUserDto) {
    return this.service.create(dto);
  }
  @MessagePattern('users.findAll')
  findAll() {
    return this.service.findAll();
  }
  @MessagePattern('users.findOne')
  findOne(@Payload(dtoPipe(UserIdDto, true)) dto: UserIdDto) {
    return this.service.findOne(dto.id);
  }
  @MessagePattern('users.update')
  update(@Payload(dtoPipe(UpdateUserMessage, true)) dto: UpdateUserMessage) {
    return this.service.update(dto.id, dto.data);
  }
  @MessagePattern('users.remove')
  remove(@Payload(dtoPipe(UserIdDto, true)) dto: UserIdDto) {
    return this.service.remove(dto.id);
  }
}
