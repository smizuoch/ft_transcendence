-- CreateTable(ここで実際にテーブルを作成します)
CREATE TABLE "users" (
    "username" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- 実際のSQLコマンドが含まれており、ユーザーテーブルの作成とメールアドレス用のユニークインデックス設定が記述されています。