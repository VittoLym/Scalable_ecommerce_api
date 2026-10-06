import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductService } from './product.service';

describe('ProductService.reservedStock', () => {
  let service: ProductService;

  const prismaMock = {
    product: { updateMany: jest.fn() },
    stockReservation: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const NOW = new Date('2026-01-01T00:00:00.000Z').getTime();
  const FIFTEEN_MINUTES = 15 * 60 * 1000;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);

    // Run the transaction callback against the same mock
    prismaMock.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prismaMock),
    );

    // useMocker injects the Prisma mock and auto-mocks any other dependency
    // the service may have (Redis, config, etc.).
    const moduleRef = await Test.createTestingModule({
      providers: [ProductService],
    })
      .useMocker((token) =>
        typeof token === 'function' && token.name === 'PrismaService'
          ? prismaMock
          : {},
      )
      .compile();

    service = moduleRef.get(ProductService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('decrements stock with a conditional update and creates a PENDING reservation', async () => {
    prismaMock.product.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.stockReservation.create.mockResolvedValue({ id: 'r1' });

    const result = await service.reservedStock({
      orderId: 'o1',
      items: [{ productId: 'p1', quantity: 2 }],
    });

    // The "stock >= quantity" condition is what prevents overselling
    expect(prismaMock.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', stock: { gte: 2 } },
      data: { stock: { decrement: 2 }, reserved: { increment: 2 } },
    });
    expect(prismaMock.stockReservation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'p1',
        orderId: 'o1',
        quantity: 2,
        status: 'PENDING',
      }),
    });
    expect(result).toEqual([{ id: 'r1' }]);
  });

  it('sets the reservation to expire 15 minutes from now', async () => {
    prismaMock.product.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.stockReservation.create.mockResolvedValue({ id: 'r1' });

    await service.reservedStock({
      orderId: 'o1',
      items: [{ productId: 'p1', quantity: 1 }],
    });

    const { data } = prismaMock.stockReservation.create.mock.calls[0][0];
    expect(data.expiresAt).toEqual(new Date(NOW + FIFTEEN_MINUTES));
  });

  it('reserves every item of the order', async () => {
    prismaMock.product.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.stockReservation.create
      .mockResolvedValueOnce({ id: 'r1' })
      .mockResolvedValueOnce({ id: 'r2' });

    const result = await service.reservedStock({
      orderId: 'o1',
      items: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 3 },
      ],
    });

    expect(prismaMock.product.updateMany).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('fails and creates no reservation when there is not enough stock', async () => {
    // count 0 means no row matched "stock >= quantity"
    prismaMock.product.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.reservedStock({
        orderId: 'o1',
        items: [{ productId: 'p1', quantity: 5 }],
      }),
    ).rejects.toThrow(/Stock insuficiente/);

    expect(prismaMock.stockReservation.create).not.toHaveBeenCalled();
  });

  it('stops at the first item without stock', async () => {
    prismaMock.product.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prismaMock.stockReservation.create.mockResolvedValue({ id: 'r1' });

    await expect(
      service.reservedStock({
        orderId: 'o1',
        items: [
          { productId: 'p1', quantity: 1 },
          { productId: 'p2', quantity: 1 },
        ],
      }),
    ).rejects.toThrow(/p2/);

    // Only the first reservation was attempted. In the real database the
    // transaction rolls the first one back; that needs an integration test.
    expect(prismaMock.stockReservation.create).toHaveBeenCalledTimes(1);
  });

  it('merges duplicated items of the same product into a single reservation', async () => {
    prismaMock.product.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.stockReservation.create.mockResolvedValue({ id: 'r1' });

    await service.reservedStock({
      orderId: 'o1',
      items: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p1', quantity: 2 },
      ],
    });

    expect(prismaMock.product.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1', stock: { gte: 3 } } }),
    );
  });

  it.each([0, -1, 1.5])(
    'rejects an invalid quantity (%p) before touching the database',
    async (quantity) => {
      await expect(
        service.reservedStock({
          orderId: 'o1',
          items: [{ productId: 'p1', quantity }],
        }),
      ).rejects.toThrow(/Cantidad invalida/);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    },
  );

  it('rejects an item without productId', async () => {
    await expect(
      service.reservedStock({
        orderId: 'o1',
        items: [{ productId: '', quantity: 1 }],
      }),
    ).rejects.toThrow(/productId es requerido/);
  });

  it.todo('two concurrent reservations for the last unit: only one succeeds (integration test with a real PostgreSQL)');
  it.todo('expired reservations (expiresAt in the past) return their stock');
});
