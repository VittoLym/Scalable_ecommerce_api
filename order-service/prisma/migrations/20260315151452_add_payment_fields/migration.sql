-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentDate" TIMESTAMP(3),
ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "paymentStatus" TEXT;
