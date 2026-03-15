import { OrderStatus } from '@prisma/client';

export class StatusUtils {
  static isStatusAllowed(
    currentStatus: OrderStatus,
    allowedStatuses: OrderStatus[],
  ): boolean {
    return allowedStatuses.includes(currentStatus);
  }

  static readonly CANCELLABLE_STATUSES: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
  ];

  static readonly MODIFIABLE_STATUSES: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
  ];
}
