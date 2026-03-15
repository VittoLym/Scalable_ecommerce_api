export class NumberUtils {
  static toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    if (value.toNumber) return value.toNumber(); // Para Decimal de Prisma
    return Number(value) || 0;
  }

  static calculateSubtotal(items: any[]): number {
    return items.reduce((sum, item) => {
      return sum + (this.toNumber(item.unitPrice) * item.quantity);
    }, 0);
  }
}
