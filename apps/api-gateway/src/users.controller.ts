import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { map, timeout } from 'rxjs';

interface User {
  id: number;
  name: string;
}

@Controller('users')
export class UsersController {
  constructor(
    @Inject('USERS_SERVICE') private readonly usersClient: ClientProxy,
  ) {}

  @Get()
  findAll() {
    return this.usersClient
      .send<User[]>('users.findAll', {})
      .pipe(timeout(5000));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersClient.send<User | null>('users.findOne', id).pipe(
      timeout(5000),
      map((user) => {
        if (!user) throw new NotFoundException('Usuário não encontrado');
        return user;
      }),
    );
  }
}
