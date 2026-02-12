import { Controller, Get } from '@nestjs/common';
import { UserService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly user: UserService) {}

  @Get()
  getHello(): string {
    return this.user.getHello();
  }
}
