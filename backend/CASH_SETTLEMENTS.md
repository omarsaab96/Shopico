# Driver cash settlements

In the admin panel, open **Cash settlements** and select a driver. The balance contains delivered cash-on-delivery orders whose payment is pending. Each currency is displayed separately. Receive one order, selected orders, or all the driver's outstanding orders after physically receiving the cash.

Assign these permissions through Users → Permissions:

- `cash-settlements:view`: open the page and inspect outstanding cash and recent receipts.
- `cash-settlements:manage`: receive cash; also requires the view permission.

Existing users do not receive the new permissions automatically. Deploy the backend and admin updates, assign permissions to the appropriate staff, and publish the mobile update for the driver's outstanding-cash display.

## Payment and receipt behavior

- Delivering an order leaves COD payment pending. Settlement changes only its payment status to confirmed; the delivery status and order total remain unchanged.
- The order stores its receipt atomically with payment confirmation: amount, currency, driver, receiving staff member, time, batch request ID, and optional note.
- The page lists the most recent 50 order receipts. Existing confirmed orders are treated as already paid and are excluded from outstanding balances.
- COD orders already delivered by a driver cannot be reopened to another delivery status, and payments with a cash receipt cannot be reverted to pending through ordinary order edits. Driver reassignment after delivery is also blocked.
- Each selected order settles in full. Partial payments against a single order are not supported.
- Each order saves independently with optimistic concurrency on standalone MongoDB. A concurrent change, prior settlement, wrong driver, wrong branch, or changed amount/currency causes that order to be skipped. A batch may therefore settle some orders and skip others; review the refreshed balance and receipts before retrying.
- The driver app shows pending delivered COD cash by currency, receives payment-confirmation notifications, and refreshes on foreground, notifications, manual refresh, and periodically while active.

## API

`GET /api/cash-settlements` returns the selected branch's drivers, outstanding orders, and recent receipts.

`POST /api/cash-settlements` accepts:

```json
{
  "branchId": "branch ObjectId",
  "driverId": "driver ObjectId",
  "requestId": "UUID",
  "orders": [
    { "orderId": "order ObjectId", "expectedTotal": 105, "currencyId": "currency ObjectId" }
  ],
  "note": "Optional receipt note"
}
```

The response contains `settledIds` and `skippedIds`. Requests accept up to 1,000 distinct orders; the admin page splits larger selections into batches. Both endpoints require an authenticated admin, manager, or staff account with branch access and the appropriate permissions.
