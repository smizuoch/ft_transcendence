import { Controller, Get, Post, Body, Param, ValidationPipe } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }
}



// このControllerが提供する機能：

// /users に対するPOSTリクエストでユーザーを作成
// /users に対するGETリクエストで全ユーザーのリストを取得
// /users/:id に対するGETリクエストで特定のユーザーを取得
