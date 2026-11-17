-- کد تخفیف در صندوق — docs/plans/webhesab-parity.md بخش ۲۶ (همه افزایشی)
ALTER TABLE "Coupon" ADD COLUMN "onlineEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Coupon" ADD COLUMN "posEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Coupon" ADD COLUMN "batch" TEXT;
CREATE INDEX "Coupon_batch_idx" ON "Coupon"("batch");

ALTER TABLE "CouponRedemption" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "CouponRedemption" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "CouponRedemption" ADD COLUMN "posTicketId" TEXT;
CREATE UNIQUE INDEX "CouponRedemption_couponId_posTicketId_key" ON "CouponRedemption"("couponId", "posTicketId");

ALTER TABLE "AccPosTicket" ADD COLUMN "couponId" TEXT;
ALTER TABLE "AccPosTicket" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "AccPosTicket" ADD COLUMN "couponDiscount" BIGINT NOT NULL DEFAULT 0;
