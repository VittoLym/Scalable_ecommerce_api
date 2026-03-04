/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// category.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { FilterCategoryDto } from './dtos/filter-category.dto';
import { ProductService } from '../product.service';
import { RedisService } from '../../redis/redis.service';
import { Prisma, Category } from '@prisma/client';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProductService))
    private readonly productService: ProductService,
    private readonly redisService: RedisService,
  ) {}
  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    try {
      const { parentId, ...restData } = createCategoryDto;
      const existingCategory = await this.prisma.category.findFirst({
        where: {
          name: restData.name,
          isActive: true,
          deletedAt: null,
        },
      });
      if (existingCategory) {
        throw new ConflictException(
          `Category with name "${restData.name}" already exists`,
        );
      }
      if (parentId) {
        const parentExists = await this.prisma.category.findUnique({
          where: { id: parentId },
        });
        if (!parentExists) {
          throw new NotFoundException(
            `Parent category with ID ${parentId} not found`,
          );
        }
      }
      // Crear la categoría
      const createdCategory = await this.prisma.category.create({
        data: {
          ...restData,
          parentId: parentId || null,
        },
        include: {
          parent: true,
        },
      });
      if (parentId) {
        await this.updateSubcategoriesFlag(parentId);
      }
      // Limpiar cache
      await this.redisService.del('categories:all');
      await this.redisService.del('categories:tree');

      return createdCategory;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
  async findAll(filterDto: FilterCategoryDto): Promise<{
    data: Category[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      search,
      isActive,
      parentId,
      includeSubcategories,
      page = 1,
      limit = 10,
      sortBy = 'name',
      sortOrder = 'asc',
    } = filterDto;
    const where: Prisma.CategoryWhereInput = {
      deletedAt: null,
    };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (parentId) {
      where.parentId = parentId;
    } else if (!includeSubcategories) {
      where.parentId = null;
    }
    const skip = (page - 1) * limit;
    const orderBy = {
      [sortBy]: sortOrder,
    };
    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: {
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              children: true,
              products: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.category.count({ where }),
    ]);
    return {
      data,
      total,
      page,
      limit,
    };
  }
  async findById(id: string): Promise<Category> {
    const cacheKey = `category:${id}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return cached as Category;
    }

    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          where: {
            deletedAt: null,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    if (!category || category.deletedAt) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    await this.redisService.set(cacheKey, category, 3600);
    return category;
  }
  async getProducts(id: string): Promise<any> {
    const category = await this.findById(id);
    let categoryIds = [id];
    if (category.hasSubcategories) {
      const subcategories = await this.prisma.category.findMany({
        where: {
          parentId: id,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      categoryIds = [...categoryIds, ...subcategories.map((sub) => sub.id)];
    }
    const products = await this.productService.findByCategories(categoryIds);
    return {
      category: category.name,
      products,
      totalProducts: products.length,
      includesSubcategories: category.hasSubcategories,
    };
  }
  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findById(id);
    const { parentId, ...restData } = updateCategoryDto;
    if (restData.name && restData.name !== category.name) {
      const existingCategory = await this.prisma.category.findFirst({
        where: {
          name: restData.name,
          isActive: true,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (existingCategory) {
        throw new ConflictException(
          `Category with name "${restData.name}" already exists`,
        );
      }
    }
    if (parentId !== undefined) {
      if (parentId === id) {
        throw new ConflictException('Category cannot be its own parent');
      }
      if (parentId) {
        const parentExists = await this.prisma.category.findUnique({
          where: { id: parentId },
        });
        if (!parentExists) {
          throw new NotFoundException(
            `Parent category with ID ${parentId} not found`,
          );
        }
        await this.checkForCircularReference(id, parentId);
      }
    }
    const updatedCategory = await this.prisma.category.update({
      where: { id },
      data: {
        ...restData,
        parentId: parentId !== undefined ? parentId : category.parentId,
      },
      include: {
        parent: true,
      },
    });
    if (parentId !== undefined) {
      await this.updateSubcategoriesFlag(id);
      if (category.parentId) {
        await this.updateSubcategoriesFlag(category.parentId);
      }
      if (parentId) {
        await this.updateSubcategoriesFlag(parentId);
      }
    }
    await this.redisService.del(`category:${id}`);
    await this.redisService.del('categories:all');
    await this.redisService.del('categories:tree');

    return updatedCategory;
  }
  async remove(id: string): Promise<void> {
    const category = await this.findById(id);
    const hasProducts = await this.productService.existsInCategory(id);
    if (hasProducts) {
      throw new ConflictException(
        'Cannot delete category with associated products',
      );
    }
    const subcategoriesCount = await this.prisma.category.count({
      where: {
        parentId: id,
        deletedAt: null,
      },
    });

    if (subcategoriesCount > 0) {
      throw new ConflictException('Cannot delete category with subcategories');
    }
    if (category.isActive) {
      await this.prisma.category.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });
    } else {
      await this.prisma.category.delete({
        where: { id },
      });
    }
    if (category.parentId) {
      await this.updateSubcategoriesFlag(category.parentId);
    }
    await this.redisService.del(`category:${id}`);
    await this.redisService.del('categories:all');
    await this.redisService.del('categories:tree');
  }
  async getCategoryTree(): Promise<any[]> {
    const cacheKey = 'categories:tree';
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached as any[];
    }
    const categories = await this.prisma.category.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
    const categoryMap = new Map();
    const roots: any[] = [];
    categories.forEach((category) => {
      categoryMap.set(category.id, {
        ...category,
        children: [],
      });
    });
    categories.forEach((category) => {
      const categoryWithChildren = categoryMap.get(category.id);
      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children.push(categoryWithChildren);
        }
      } else {
        roots.push(categoryWithChildren);
      }
    });
    await this.redisService.set(cacheKey, roots, 3600);
    return roots;
  }
  async getBreadcrumb(id: string): Promise<any[]> {
    const breadcrumb: Array<{ id: string; name: string }> = [];
    let currentId = id;
    while (currentId) {
      const category = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          name: true,
          parentId: true,
          deletedAt: true,
        },
      });

      if (!category || category.deletedAt) break;

      breadcrumb.unshift({
        id: category.id,
        name: category.name,
      });

      currentId = category.parentId || 'id';
    }

    return breadcrumb;
  }
  async moveCategory(
    id: string,
    newParentId: string | null,
  ): Promise<Category> {
    const category = await this.findById(id);
    const oldParentId = category.parentId;
    if (newParentId) {
      if (newParentId === id) {
        throw new ConflictException('Category cannot be its own parent');
      }
      await this.checkForCircularReference(id, newParentId);
    }
    const updatedCategory = await this.prisma.category.update({
      where: { id },
      data: {
        parentId: newParentId,
      },
      include: {
        parent: true,
      },
    });
    await this.updateSubcategoriesFlag(id);
    if (oldParentId) {
      await this.updateSubcategoriesFlag(oldParentId);
    }
    if (newParentId) {
      await this.updateSubcategoriesFlag(newParentId);
    }
    await this.redisService.del(`category:${id}`);
    await this.redisService.del('categories:tree');
    return updatedCategory;
  }
  async bulkUpdateStatus(ids: string[], isActive: boolean): Promise<void> {
    await this.prisma.category.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        isActive,
        updatedAt: new Date(),
      },
    });
    await Promise.all(ids.map((id) => this.redisService.del(`category:${id}`)));
    await this.redisService.del('categories:all');
    await this.redisService.del('categories:tree');
  }
  private async checkForCircularReference(
    categoryId: string,
    parentId: string,
  ): Promise<void> {
    let currentParentId = parentId;
    const visited = new Set<string>();
    while (currentParentId) {
      if (visited.has(currentParentId)) {
        throw new ConflictException(
          'Circular reference detected in category hierarchy',
        );
      }
      visited.add(currentParentId);
      if (currentParentId === categoryId) {
        throw new ConflictException(
          'Circular reference detected: category cannot be ancestor of itself',
        );
      }
      const parent = await this.prisma.category.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      });
      if (!parent) break;
      currentParentId = parent.parentId || 'id';
    }
  }
  private async updateSubcategoriesFlag(categoryId: string): Promise<void> {
    const hasSubcategories = await this.prisma.category.count({
      where: {
        parentId: categoryId,
        deletedAt: null,
      },
    });
    await this.prisma.category.update({
      where: { id: categoryId },
      data: {
        hasSubcategories: hasSubcategories > 0,
      },
    });
  }
  async findByName(name: string): Promise<Category | null> {
    const byName = await this.prisma.category.findFirst({
      where: {
        name,
        deletedAt: null,
      },
    });
    return byName ?? null;
  }
  async getCategoryPath(id: string): Promise<string[]> {
    const path: string[] = [];
    let currentId = id;
    while (currentId) {
      const category = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          name: true,
          parentId: true,
        },
      });
      if (!category) break;
      path.unshift(category.name);
      currentId = category.parentId || 'id';
    }

    return path;
  }
  async getCategoryStats(): Promise<any> {
    const [
      totalCategories,
      activeCategories,
      rootCategories,
      categoriesWithProducts,
    ] = await Promise.all([
      this.prisma.category.count({ where: { deletedAt: null } }),
      this.prisma.category.count({
        where: { isActive: true, deletedAt: null },
      }),
      this.prisma.category.count({
        where: { parentId: null, deletedAt: null },
      }),
      this.prisma.category.count({
        where: {
          deletedAt: null,
          products: {
            some: {},
          },
        },
      }),
    ]);
    return {
      total: totalCategories,
      active: activeCategories,
      root: rootCategories,
      withProducts: categoriesWithProducts,
    };
  }
}
