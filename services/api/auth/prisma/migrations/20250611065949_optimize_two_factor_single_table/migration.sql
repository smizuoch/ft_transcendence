/*
  Warnings:

  - You are about to drop the `two_factor_codes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "two_factor_codes";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "users" (
    "username" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "twoFactorCode" TEXT,
    "twoFactorExpiresAt" DATETIME,
    "twoFactorIsUsed" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
