import {
  Controller,
  Get,
  Body,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { FilterProductDto } from '../dto/filter-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { ClientProxy } from '@nestjs/microservices';
import { RedisService } from 'src/redis/redis.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Logger } from '@nestjs/common';

@Controller('products')
export class ProductController {
  private readonly logger = new Logger(ProductController.name);
  constructor(
    private readonly service: ProductService,
    @Inject('EVENT_BUS') private userClient: ClientProxy,
    private readonly redisService: RedisService,
  ) {}

  @UseGuards(AdminGuard)
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    const healthStatus = {
      status: 'ok',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      dependencies: {
        database: 'unknown',
        rabbitmq: 'unknown',
        redis: 'unknown',
      },
    };
    try {
      await this.service.checkDatabaseConnection();
      healthStatus.dependencies.database = 'connected';
    } catch (error) {
      console.log(error, '.');
      healthStatus.dependencies.database = 'disconnected';
      healthStatus.status = 'degraded';
    }
    try {
      if (this.userClient) {
        console.log('📤 Enviando ping a product-service...');
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('RabbitMQ timeout')), 3000),
        );
        const pingPromise = this.userClient
          .send('ping', { from: 'user-service', timestamp: Date.now() })
          .toPromise();
        const result = await Promise.race([pingPromise, timeoutPromise]);
        if (result && result.pong) {
          console.log('✅ Ping exitoso a product-service');
          healthStatus.dependencies.rabbitmq = 'connected';
        } else {
          healthStatus.dependencies.rabbitmq = 'error';
          healthStatus.status = 'degraded';
        }
      } else {
        healthStatus.dependencies.rabbitmq = 'not_configured';
      }
    } catch (error) {
      console.error('❌ RabbitMQ error:', error.message);
      healthStatus.dependencies.rabbitmq = 'disconnected';
      healthStatus.status = 'degraded';
    }
    try {
      const pingResult = await this.redisService.ping();
      healthStatus.dependencies.redis = pingResult ? 'connected' : 'error';
    } catch (error) {
      healthStatus.dependencies.redis = 'disconnected';
      healthStatus.status = 'degraded';
    }

    return healthStatus;
  }
  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }
  @UseGuards(AdminGuard)
  @MessagePattern('ping')
  handlePing(@Payload() data: any) {
    console.log('📡 Ping recibido en product-service desde:', data?.from);
    return {
      pong: true,
      timestamp: new Date().toISOString(),
      service: 'product-service',
      receivedFrom: data?.from || 'pikiblainder'
    };
  }
  @Get()
  findAll(@Query() filter: FilterProductDto) {
    return this.service.findAll(filter);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
  @MessagePattern('inventory.check')
  async checkInventory(
    @Payload()
    data: {
      orderId: string;
      items: { productId: string; quantity: number }[];
    },
  ) {
    try {
      this.logger.log(`📦 Verificando stock para orden: ${data.orderId}`);
      const productsWithStock = await this.service.verifyStock(data);
      if (productsWithStock === null) return 'mandarina con pollo';
      return productsWithStock;
    } catch (error) {
      this.logger.error(`❌ Error verificando stock: ${error.message}`);
      return {
        success: false,
        orderId: data.orderId,
        error: error.message,
      };
    }
  }
}
