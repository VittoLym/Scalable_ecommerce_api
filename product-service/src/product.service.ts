import { Injectable, NotFoundException } from '@nestjs/common';
import { FilterProductDto } from './dto/filter-product.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
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
    const productData = await this.prisma.product.create({
      data: dto,
    });
    if (productData != undefined) return { error: 'error creating product' };

    return productData;
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
}
