# One active delivery per driver

Drivers can have multiple queued (`PENDING` or `PROCESSING`) orders, but only one
`SHIPPING` order across all branches. The `one_shipping_order_per_driver` partial
unique index enforces this even for concurrent requests and staff reassignment.
The server installs the index before accepting requests. Conflicts return HTTP
409 with code `DRIVER_ALREADY_DELIVERING`.

Before deploying to an existing database, check for overlapping deliveries in
mongosh connected to that database:

```javascript
db.orders.aggregate([
  { $match: { status: "SHIPPING", driverId: { $type: "objectId" } } },
  { $group: { _id: "$driverId", orders: { $push: "$_id" }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
```

If the query returns records, staff must reconcile those orders according to
which delivery is actually active before deployment. The migration does not
change order statuses or mark deliveries complete automatically. MongoDB cannot
build the unique index while overlapping deliveries exist, and server startup
will fail rather than accept unprotected delivery starts.
