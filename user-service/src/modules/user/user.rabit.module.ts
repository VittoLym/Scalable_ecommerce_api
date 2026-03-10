import { Module, forwardRef } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { RabbitController } from './user.rabbit.controller';

@Module({
  imports: [forwardRef(() => UserModule)], // Importar UserModule para usar UserService
  controllers: [RabbitController],
  providers: [],
  exports: [],
})
export class RabbitModule {}
