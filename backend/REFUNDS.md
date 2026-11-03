Item refunds
============

Staff with `orders:view` and `orders:update` can preview and confirm item refunds
from order details while the order is PENDING or PROCESSING. Quantities are partial
integer quantities, limited to units not already refunded.

The original item quantities and prices remain on the order. `refundedQuantity`
tracks removed units. Subtotal, discount and total reflect the remaining items;
`refundTotal` and `refunds` preserve the adjustment history and issuing employee.
Merchandise discounts are prorated; delivery fees and delivery discounts remain.

Orders whose payment is CONFIRMED receive credit in the order's wallet currency.
Unpaid orders only have their payable total reduced. Newly created orders store
their checkout exchange rate and delivery discount. Legacy orders use the current
currency rate if no checkout rate exists, and infer free delivery from their saved
coupon codes when the coupons still exist. The preview shows the exact wallet
credit before confirmation.

Deployment: MongoDB must support multi-document transactions (a replica set or
mongos). Order, wallet, wallet transaction, membership and audit changes commit
together. A failed transaction must not be retried using independent writes.
Repeated request IDs are idempotent, and stale previews are rejected. Rebuild and
restart the backend and deploy the updated admin bundle together.

Validation: `npm run build` and `npx vitest run src/tests` in backend; `npm run build`
in admin. Refund service tests mock the transaction boundary; they do not replace
a staging check against a transaction-capable MongoDB deployment.
