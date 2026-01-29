export const PERMISSION_GROUPS = [
  {
    key: "general",
    labelKey: "perm.group.general",
    permissions: [
      { key: "dashboard:view", labelKey: "perm.dashboard.view" },
      { key: "audit:view", labelKey: "perm.audit.view" },
    ],
  },
  {
    key: "catalog",
    labelKey: "perm.group.catalog",
    permissions: [
      { key: "products:view", labelKey: "perm.products.view" },
      { key: "products:manage", labelKey: "perm.products.manage" },
      { key: "products:import", labelKey: "perm.products.import" },
      { key: "categories:view", labelKey: "perm.categories.view" },
      { key: "categories:manage", labelKey: "perm.categories.manage" },
      { key: "uploads:auth", labelKey: "perm.uploads.auth" },
    ],
  },
  {
    key: "orders",
    labelKey: "perm.group.orders",
    permissions: [
      { key: "orders:view", labelKey: "perm.orders.view" },
      { key: "orders:update", labelKey: "perm.orders.update" },
      { key: "wallet:topups:view", labelKey: "perm.wallet.topups.view" },
      { key: "wallet:topups:create", labelKey: "perm.wallet.topups.create" },
      { key: "wallet:manage", labelKey: "perm.wallet.manage" },
    ],
  },
  {
    key: "marketing",
    labelKey: "perm.group.marketing",
    permissions: [
      { key: "announcements:view", labelKey: "perm.announcements.view" },
      { key: "announcements:manage", labelKey: "perm.announcements.manage" },
      { key: "coupons:view", labelKey: "perm.coupons.view" },
      { key: "coupons:manage", labelKey: "perm.coupons.manage" },
    ],
  },
  {
    key: "users",
    labelKey: "perm.group.users",
    permissions: [
      { key: "users:view", labelKey: "perm.users.view" },
      { key: "users:manage", labelKey: "perm.users.manage" },
    ],
  },
  {
    key: "settings",
    labelKey: "perm.group.settings",
    permissions: [
      { key: "settings:view", labelKey: "perm.settings.view" },
      { key: "settings:manage", labelKey: "perm.settings.manage" },
    ],
  },
] as const;

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key)
);
