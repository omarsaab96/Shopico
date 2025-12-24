# Shopico Monorepo

Monorepo containing:
- **backend**: Express + TypeScript + MongoDB + Mongoose + Zod + ImageKit direct upload auth
- **admin**: Vite + React + TypeScript orange-themed control panel
- **mobile**: Expo (React Native) + TypeScript + expo-router app for customers

## Quick start
1) Install dependencies per package:
```bash
cd backend && npm install
cd ../admin && npm install
cd ../mobile && npm install
```

2) Configure environment:
- Copy `backend/.env.example` -> `backend/.env` and set Mongo URI, JWT secrets, ImageKit keys, store location, delivery pricing.
- Copy `admin/.env.example` -> `admin/.env` and point `VITE_API_BASE` to the backend URL.
- Mobile uses `EXPO_PUBLIC_API_BASE` env when running (`EXPO_PUBLIC_API_BASE=http://localhost:4000/api npx expo start`).

3) Run apps:
- Backend API: `cd backend && npm run dev`
- Admin panel: `cd admin && npm run dev`
- Mobile app: `cd mobile && npx expo start`

4) Seed sample data and admin user:
```bash`
cd backend
npm run seed
# defaults: admin@shopico.local / password123
```

## Backend highlights
- Auth: email/password, JWT access/refresh (cookies + body), role-based (customer/admin/staff)
- Models: Users, Categories, Products (ImageKit URLs + fileIds), Cart, Orders, Wallet + ledger, Points + RewardToken, Settings, Audit logs, Top-up requests
- Delivery fees: free up to 1 km, then 5,000 SYP per km (Haversine formula)
- Payments: COD, SHAM_CASH, BANK_TRANSFER, WALLET; admin can confirm SHAM/BANK
- Loyalty: points ledger (1 per 10k SYP subtotal), reward token at 100 pts for 80k SYP discount
- Membership: balance-based levels with grace days (configurable)
- ImageKit: `/api/uploads/imagekit-auth` returns signature/token for direct client uploads
- Tests: `npm test` covers delivery pricing + points helpers

## Admin panel
- Orange, modern theme; sidebar navigation
- Screens: Dashboard, Products (ImageKit upload + CRUD), Categories, Orders (status/payment confirmation), Users detail with wallet/points history, Wallet top-up approvals, Settings editor (delivery rules, thresholds, grace days), Audit log viewer
- Auth tokens stored locally (httpOnly cookies also supported by backend)

## Mobile app (Expo)
- expo-router navigation; SecureStore for tokens; AsyncStorage cart sync
- Screens: Auth (login/register/forgot), Home, Categories, Product details, Cart, Checkout (delivery breakdown + payment method + reward toggle), Orders list/details (status stepper), Wallet (top-up request + ledger), Membership (level, progress, congrats modal), Points (progress to reward), Profile, Settings
- Delivery fee preview uses Haversine on client; server recalculates on checkout

## Notes
- ImageKit upload from admin uses the backend auth endpoint; store both `url` and `fileId` on products.
- REST base path: `/api`.
- Default delivery rules: free 1 km, 5,000 SYP each additional km (rounded up).
