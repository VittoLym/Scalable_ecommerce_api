import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from '../auth/dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() data: LoginUserDto) {
    return this.authService.login(data);
  }
  @Post('register')
  regisrter(@Body() data: RegisterDto) {
    console.log(data);
  }
}
