import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FilterProductDto } from '../dto/filter-product.dto';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { Product } from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}
  private readonly logger = new Logger(ProductService.name);
  async findAll(filterDto: FilterProductDto) {
    const {
      search,
      minPrice,
      maxPrice,
      isActive,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'desc',
    } = filterDto;

    const where: any = {};

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          [sortBy]: order,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }
  async create(dto: CreateProductDto) {
    try {
      const productData = {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        stock: dto.stock,
        isActive: dto.isActive ?? true,
        categoryId: dto.categoryId,
      };
      console.log('Datos a insertar:', productData);
      const product = await this.prisma.product.create({
        data: productData,
        include: {
          category: true,
        },
      });
      return {
        success: true,
        message: 'Product created successfully',
        data: product,
      };
    } catch (error) {
      console.error('Error creating product:', error);
      return {
        success: false,
        error: 'Error creating product',
        details: error.message
      };
    }
  }
  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }
  async update(id: string, dto: UpdateProductDto) {
    await this.findById(id);

    return this.prisma.product.update({
      where: { id },
      data: dto,
    });
  }
  async remove(id: string) {
    await this.findById(id);
    return this.prisma.product.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
  async checkDatabaseConnection(): Promise<boolean> {
    if (!this.prisma) {
      console.error('Prisma is undefined in checkDatabaseConnection');
      throw new Error('Prisma service not initialized');
    }
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.log(error);
      throw new Error('Database connection failed');
    }
  }
  // ============= MÉTODOS PARA CATEGORÍAS =============

  async findByCategories(categoryIds: string[]): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        categoryId: {
          in: categoryIds,
        },
        isActive: true,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
  async existsInCategory(categoryId: string): Promise<boolean> {
    const count = await this.prisma.product.count({
      where: {
        categoryId: categoryId,
        isActive: true,
      },
    });
    return count > 0;
  }
  async countByCategory(categoryId: string): Promise<number> {
    return this.prisma.product.count({
      where: {
        categoryId: categoryId,
        isActive: true,
      },
    });
  }
  async getProductsByCategory(
    categoryId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: Product[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          categoryId: categoryId,
          isActive: true,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          name: 'asc',
        },
      }),
      this.prisma.product.count({
        where: {
          categoryId: categoryId,
          isActive: true,
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }
  async getCategoryProductStats(categoryId: string): Promise<any> {
    const [totalProducts, activeProducts, totalValue, averagePrice] =
      await Promise.all([
        this.prisma.product.count({
          where: {
            categoryId: categoryId,
          },
        }),
        this.prisma.product.count({
          where: {
            categoryId: categoryId,
            isActive: true,
          },
        }),
        this.prisma.product.aggregate({
          where: {
            categoryId: categoryId,
          },
          _sum: {
            price: true,
          },
        }),
        this.prisma.product.aggregate({
          where: {
            categoryId: categoryId,
          },
          _avg: {
            price: true,
          },
        }),
      ]);
    return {
      categoryId,
      totalProducts,
      activeProducts,
      inactiveProducts: totalProducts - activeProducts,
      totalValue: totalValue._sum.price || 0,
      averagePrice: averagePrice._avg.price || 0,
    };
  }
}
