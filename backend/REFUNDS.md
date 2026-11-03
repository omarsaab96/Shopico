Item refunds
============

Staff with `orders:view` and `orders:update` can preview and confirm item refunds
from order details while the order is PENDING or PROCESSING. Quantities are partial
integer quantities, limited to units not already refunded.

The original item quantities and prices remain on the order. `refundedQuantity`
tracks removed units. Subtotal, discount and total reflect the remaining items;
`refundTotal` and `refunds` preserve the adjustment history and issuing employee.
Merchandise discounts are prorated. Delivery fees and delivery discounts remain
for partial refunds. Refunding the final remaining unit cancels the order, zeros
all charges, and credits the full remaining paid balance (including delivery)
or removes the full unpaid balance. Fully refunded orders cannot be reopened.

Orders whose payment is CONFIRMED receive credit in the order's wallet currency.
Unpaid orders only have their payable total reduced. Newly created orders store
their checkout exchange rate and delivery discount. Legacy orders use the current
currency rate if no checkout rate exists, and infer free delivery from their saved
coupon codes when the coupons still exist. The preview shows the exact wallet
credit before confirmation.

Deployment: standalone MongoDB is supported; no transactions or replica set are
required. Rebuild and restart the backend and deploy the updated admin bundle.

The order adjustment and a PENDING refund record are saved atomically in the order
document using optimistic concurrency. A wallet credit saves both the new balance
and a permanent `refundReceipts` entry in one wallet document. Concurrent retries
re-read that receipt instead of crediting again. Wallet saves also use optimistic
concurrency, so concurrent credits or other wallet operations cannot overwrite
each other silently. Do not prune these receipts without a coordinated migration.

Ledger and audit records use deterministic IDs and idempotent upserts. Once credit,
ledger, membership, driver status and audit processing finish, the refund is marked
COMPLETED. Failures after the order adjustment leave a visible pending state, not
a false failure that encourages a second refund. `startRefundRecovery` runs at
startup and every 15 seconds, resuming pending work from the saved order records.
Retries with the same request ID also resume processing. Multiple server processes
may run recovery safely. The admin polls pending refunds until they complete.

This is eventually consistent across documents: an interrupted request can leave
the order adjusted before wallet credit or ledger processing completes. Recovery
finishes those steps without reissuing the refund. The order and wallet are never
updated using a multi-document transaction.

Validation: `npm run build` and `npx vitest run src/tests` in backend; `npm run build`
in admin. Refund service tests run an isolated real standalone MongoDB via
`mongodb-memory-server-core` and exercise concurrency, duplicate submissions and
failures before/after wallet credit, ledger/audit writes and completion. Tests use
`MONGOMS_SYSTEM_BINARY` when supplied, or the standard Windows MongoDB 8.0 path if
installed; otherwise the test runner downloads a MongoDB binary. Tests never use
the application's configured database.
