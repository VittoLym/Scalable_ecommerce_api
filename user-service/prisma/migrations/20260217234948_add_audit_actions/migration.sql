/*
  Warnings:

  - The `action` column on the `AuditLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "AuditLogAction" AS ENUM ('REGISTER', 'EMAIL_VERIFIED', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_SUCCESS', 'SESSION_REVOKED', 'REUSE_ATTACK_DETECTED', 'ADMIN_FORCE_LOGOUT');

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "action",
ADD COLUMN     "action" "AuditLogAction" NOT NULL DEFAULT 'REGISTER';
