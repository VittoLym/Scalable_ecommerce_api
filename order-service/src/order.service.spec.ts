import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrderStatus } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { EventsService } from './events/events.service';
import { OrderService } from './order.service';
import { PrismaService } from './prisma/prisma.service';

describe('OrderService', () => {
  let service: OrderService;

  const prismaMock = {
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    payment: { create: jest.fn() },
    orderStatusHistory: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const eventsMock = {
    sendCommand: jest.fn(),
    emitEvent: jest.fn(),
  };

  const makeOrder = (overrides: Record<string, unknown> = {}) => ({
    id: 'o1',
    orderNumber: 'ORD-1',
    userId: 'u1',
    status: OrderStatus.PENDING,
    totalAmount: 121,
    items: [],
    payments: [],
    ...overrides,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    // Keep the test output clean
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();

    // Run transaction callbacks against the same mock
    prismaMock.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prismaMock),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventsService, useValue: eventsMock },
      ],
    }).compile();

    service = moduleRef.get(OrderService);
  });

  describe('create', () => {
    const dto = {
      userId: 'u1',
      userEmail: 'ana@example.com',
      idempotencyKey: 'key-1',
      items: [{ productId: 'p1', quantity: 2, unitPrice: 50 }],
      shippingAddress: {
        street: 'Calle 1',
        city: 'Mendoza',
        zipCode: '5500',
        country: 'AR',
      },
    } as unknown as CreateOrderDto;

    it('returns the existing order and does nothing else when the idempotency key was already used', async () => {
      const existing = makeOrder({ idempotencyKey: 'key-1' });
      prismaMock.order.findUnique.mockResolvedValue(existing);

      const result = await service.create(dto);

      expect(result).toMatchObject({ existingOrder: existing });
      expect(prismaMock.order.create).not.toHaveBeenCalled();
      expect(eventsMock.emitEvent).not.toHaveBeenCalled();
      expect(eventsMock.sendCommand).not.toHaveBeenCalled();
    });

    it('creates a PENDING order with 21% tax and publishes the order.created event', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);
      eventsMock.sendCommand.mockResolvedValue([
        {
          id: 'p1',
          productId: 'p1',
          quantity: 2,
          unitPrice: 50,
          totalPrice: 100,
          tAStock: true,
          productSnapshot: { name: 'Keyboard' },
        },
      ]);
      prismaMock.order.create.mockResolvedValue(
        makeOrder({ items: [{ productId: 'p1', quantity: 2 }] }),
      );
      eventsMock.emitEvent.mockResolvedValue({ ok: true });

      await service.create(dto);

      expect(prismaMock.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u1',
            idempotencyKey: 'key-1',
            status: OrderStatus.PENDING,
            subtotal: 100,
            taxAmount: expect.closeTo(21, 2),
            totalAmount: expect.closeTo(121, 2),
          }),
        }),
      );
      expect(eventsMock.emitEvent).toHaveBeenCalledWith(
        'order.created',
        expect.objectContaining({ orderId: 'o1', userId: 'u1' }),
      );
    });

    it('asks the product service to reserve the stock after creating the order', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);
      eventsMock.sendCommand.mockResolvedValue([
        { id: 'p1', productId: 'p1', quantity: 2, unitPrice: 50, totalPrice: 100, tAStock: true },
      ]);
      prismaMock.order.create.mockResolvedValue(
        makeOrder({ items: [{ productId: 'p1', quantity: 2 }] }),
      );
      eventsMock.emitEvent.mockResolvedValue({ ok: true });

      await service.create(dto);

      expect(eventsMock.sendCommand).toHaveBeenCalledWith('stock.reserved', {
        orderId: 'o1',
        items: [{ productId: 'p1', quantity: 2 }],
      });
    });

    it.todo('handles two concurrent requests with the same idempotencyKey (unique constraint race)');
    it.todo('rejects the order when none of the items has stock');
    it.todo('does not trust the unitPrice sent by the client');
  });

  describe('updateStatus', () => {
    const owner = { id: 'u1', role: 'USER' };
    const admin = { id: 'admin', role: 'ADMIN' };

    it('throws NotFoundException when the order does not exist', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('o1', { status: OrderStatus.CONFIRMED, reason: 'x' }, owner),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when a non-admin updates someone else\'s order', async () => {
      prismaMock.order.findUnique.mockResolvedValue(makeOrder({ userId: 'other' }));

      await expect(
        service.updateStatus('o1', { status: OrderStatus.CONFIRMED, reason: 'x' }, owner),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when the order is already in that status', async () => {
      prismaMock.order.findUnique.mockResolvedValue(makeOrder());

      await expect(
        service.updateStatus('o1', { status: OrderStatus.PENDING, reason: 'x' }, owner),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows PENDING -> CONFIRMED and records it in the status history', async () => {
      prismaMock.order.findUnique.mockResolvedValue(makeOrder());
      prismaMock.order.update.mockResolvedValue(
        makeOrder({ status: OrderStatus.CONFIRMED }),
      );

      const result = await service.updateStatus(
        'o1',
        { status: OrderStatus.CONFIRMED, reason: 'paid' },
        owner,
      );

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(prismaMock.orderStatusHistory.create).toHaveBeenCalledWith({
        data: { orderId: 'o1', status: OrderStatus.CONFIRMED, reason: 'paid' },
      });
    });

    it('rejects a transition that is not allowed (DELIVERED -> PENDING)', async () => {
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder({ status: OrderStatus.DELIVERED }),
      );

      await expect(
        service.updateStatus('o1', { status: OrderStatus.PENDING, reason: 'x' }, owner),
      ).rejects.toThrow(/No se puede cambiar de DELIVERED a PENDING/);
      expect(prismaMock.order.update).not.toHaveBeenCalled();
    });

    it('lets an admin force PENDING -> SHIPPED', async () => {
      prismaMock.order.findUnique.mockResolvedValue(makeOrder());
      prismaMock.order.update.mockResolvedValue(
        makeOrder({ status: OrderStatus.SHIPPED }),
      );

      const result = await service.updateStatus(
        'o1',
        { status: OrderStatus.SHIPPED, reason: 'manual' },
        admin,
      );

      expect(result.status).toBe(OrderStatus.SHIPPED);
    });

    it('does not let a regular user force PENDING -> SHIPPED', async () => {
      prismaMock.order.findUnique.mockResolvedValue(makeOrder());

      await expect(
        service.updateStatus('o1', { status: OrderStatus.SHIPPED, reason: 'x' }, owner),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelOrder', () => {
    it('throws ForbiddenException when the order belongs to another user', async () => {
      prismaMock.order.findUnique.mockResolvedValue(makeOrder({ userId: 'u1' }));

      await expect(service.cancelOrder('o1', 'u2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('does not cancel an order that was already shipped', async () => {
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder({ status: OrderStatus.SHIPPED }),
      );

      await expect(service.cancelOrder('o1', 'u1')).rejects.toThrow(
        /No se puede cancelar una orden en estado SHIPPED/,
      );
    });

    it('cancels a PENDING order and stores the cancellation date', async () => {
      prismaMock.order.findUnique.mockResolvedValue(makeOrder());
      prismaMock.order.update.mockResolvedValue(
        makeOrder({ status: OrderStatus.CANCELLED }),
      );

      await service.cancelOrder('o1', 'u1', 'changed my mind');

      expect(prismaMock.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.CANCELLED,
            cancelledAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('processPayment', () => {
    const payment = {
      paymentMethod: 'CARD',
      transactionId: 'tx-1',
      amount: 121,
    };

    it('throws NotFoundException when the order does not exist', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(service.processPayment('o1', payment)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the order is not PENDING', async () => {
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder({ status: OrderStatus.CANCELLED }),
      );

      await expect(service.processPayment('o1', payment)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.payment.create).not.toHaveBeenCalled();
    });

    it('registers the payment, moves the order to PROCESSING and emits both events', async () => {
      prismaMock.order.findUnique.mockResolvedValue(makeOrder());
      prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' });
      prismaMock.order.update.mockResolvedValue(
        makeOrder({ status: OrderStatus.PROCESSING }),
      );
      eventsMock.emitEvent.mockResolvedValue(undefined);

      const result = await service.processPayment('o1', payment);

      expect(result.status).toBe(OrderStatus.PROCESSING);
      expect(eventsMock.emitEvent).toHaveBeenCalledWith(
        'payment.processed',
        expect.objectContaining({ orderId: 'o1', paymentId: 'pay-1', status: 'PAID' }),
      );
      expect(eventsMock.emitEvent).toHaveBeenCalledWith(
        'order.processing',
        expect.objectContaining({ orderId: 'o1', status: OrderStatus.PROCESSING }),
      );
    });
  });

  describe('updatePaymentStatus', () => {
    const paymentData = {
      paymentId: 'pay-1',
      paymentStatus: 'PAID',
      paymentDate: new Date('2026-01-01'),
    };

    it('throws NotFoundException when the order does not exist', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePaymentStatus('o1', paymentData),
      ).rejects.toThrow(NotFoundException);
    });

    it('ignores the notification when the order already has a PAID payment', async () => {
      prismaMock.order.findUnique.mockResolvedValue(
        makeOrder({ payments: [{ status: 'PAID' }] }),
      );

      const result = await service.updatePaymentStatus('o1', paymentData);

      expect(result).toHaveProperty('message');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.payment.create).not.toHaveBeenCalled();
    });

    it('confirms the order and creates the payment record when the payment is PAID', async () => {
      prismaMock.order.findUnique.mockResolvedValue(makeOrder());
      prismaMock.order.update.mockResolvedValue(
        makeOrder({ status: OrderStatus.CONFIRMED }),
      );

      await service.updatePaymentStatus('o1', paymentData);

      expect(prismaMock.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentId: 'pay-1',
            status: OrderStatus.CONFIRMED,
          }),
        }),
      );
      expect(prismaMock.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ orderId: 'o1', amount: 121, status: 'PAID' }),
      });
    });

    it('keeps the current status and creates no payment when the payment is not PAID', async () => {
      prismaMock.order.findUnique.mockResolvedValue(makeOrder());
      prismaMock.order.update.mockResolvedValue(makeOrder());

      await service.updatePaymentStatus('o1', {
        ...paymentData,
        paymentStatus: 'FAILED',
      });

      expect(prismaMock.payment.create).not.toHaveBeenCalled();
      expect(prismaMock.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: OrderStatus.PENDING }),
      });
    });
  });

  describe('known issues (documented, not fixed yet)', () => {
    // This test describes the DESIRED behavior. It uses it.failing because the
    // current code reads `order.total` (which does not exist) instead of
    // `order.totalAmount`. When the bug is fixed this test will start failing:
    // remove `.failing` at that point.
    it.failing('exportToCsv returns a CSV with the order totals', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        {
          orderNumber: 'ORD-1',
          createdAt: new Date('2026-01-01'),
          userId: 'u1',
          userEmail: 'ana@example.com',
          status: OrderStatus.PENDING,
          subtotal: 100,
          taxAmount: 21,
          shippingAmount: 0,
          discountAmount: 0,
          totalAmount: 121,
          shippingAddress: {
            street: 'Calle 1',
            city: 'Mendoza',
            zipCode: '5500',
            country: 'AR',
          },
          notes: '',
          items: [{ productId: 'p1', quantity: 1, unitPrice: 100 }],
        },
      ]);

      const csv = await service.exportToCsv({});

      expect(csv).toContain('ORD-1');
      expect(csv).toContain('121.00');
    });

    it.todo('addItems / updateShippingAddress reject users who do not own the order');
    it.todo('addItems / removeItem keep tax and shipping when recalculating totals');
    it.todo('findOne / findAll exclude soft-deleted orders');
  });
});
