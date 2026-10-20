-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "thresholdCents" INTEGER NOT NULL DEFAULT 5000,
    "messageEmpty" TEXT NOT NULL DEFAULT 'Free shipping on orders over {threshold}',
    "messageProgress" TEXT NOT NULL DEFAULT 'Add {amount} more for free shipping',
    "messageSuccess" TEXT NOT NULL DEFAULT 'Congrats! You''ve unlocked free shipping 🎉',
    "barColor" TEXT NOT NULL DEFAULT '#008060',
    "trackColor" TEXT NOT NULL DEFAULT '#e3e3e3',
    "backgroundColor" TEXT NOT NULL DEFAULT '#f6f6f7',
    "textColor" TEXT NOT NULL DEFAULT '#202223',
    "fontSize" INTEGER NOT NULL DEFAULT 14,
    "borderRadius" INTEGER NOT NULL DEFAULT 8,
    "showOnCartPage" BOOLEAN NOT NULL DEFAULT true,
    "showInDrawer" BOOLEAN NOT NULL DEFAULT true,
    "drawerPosition" TEXT NOT NULL DEFAULT 'top',
    "drawerSelector" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Settings_shop_key" ON "Settings"("shop");
