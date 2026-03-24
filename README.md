# Shopico Monorepo

Monorepo containing:
- **backend**: Express + TypeScript + MongoDB + Mongoose + Zod + ImageKit direct upload auth
- **admin**: Vite + React + TypeScript orange-themed control panel
- **mobile**: Expo (React Native) + TypeScript + expo-router app for customers

## Quick start
**1) Install dependencies per package**
```
cd backend && npm install
cd ../admin && npm install
cd ../mobile && npm install
```

**2) Configure environment**
- Copy `backend/.env.example` -> `backend/.env` and set Mongo URI, JWT secrets, ImageKit keys, store location, delivery pricing.
- Copy `admin/.env.example` -> `admin/.env` and point `VITE_API_BASE` to the backend URL.
- Mobile uses `EXPO_PUBLIC_API_BASE` env when running (`EXPO_PUBLIC_API_BASE=http://localhost:4000/api npx expo start`).

**3) Run apps**
- Backend API: `cd backend && npm run dev`
- Admin panel: `cd admin && npm run dev`
- Mobile app: `cd mobile && npx expo start`

**4) Seed sample data and admin user**
```
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

## Deployment
The project is deployed on a VPS using Nginx and PM2.

1) **Admin Deployment**<br/>
    The admin panel is a Vite React build built locally and deployed as static files served by Nginx on the VPS.
    
    **Server Location**<br/>
    Nginx serves this folder directly `/var/www/shopico/admin`<br/>
    
    **Deployment Script**<br/>
    Admin deployment is automated using a script `admin/deploy.sh`<br/><br/>
    The script performs the following steps:
    * Builds the admin panel locally
    * Removes old files from the VPS
    * Uploads the new build
    * Fixes file permissions
    * Reloads Nginx

    **1- Deploy Command**<br/>
    From the `admin` folder, run:

    ```
    .\deploy.sh 
    ```
    **2- Manual deploy**<br/>
    From the `admin` folder, run:
    ```
    npm run build
    ```
    Then upload the `dist` folder to the server
    ```
    scp -r dist/* root@SERVER_IP:/var/www/shopico/admin/
    ```
    Finally reload Nginx
    ```
    ssh root@SERVER_IP "systemctl reload nginx"
    ```

2) **Backend Deployment**<br/>
    The backend is a TypeScript Express API compiled to JavaScript and managed with PM2.<br/>
    Backend runs onport `PORT=4002`<br/>
    Nginx proxies `/api` requests to this port.

    **Server Location**<br/>
    Nginx serves this folder directly `/var/www/shopico/backend`<br/>

    **Backend structure**<br>
    ```
    backend
    ├── dist
    ├── node_modules
    ├── package.json
    ├── package-lock.json
    └── .env
    ```
    
    **Deployment Script**<br/>
    Admin deployment is automated using a script `admin/deploy.sh`<br/><br/>
    The script performs the following steps:
    * Builds the admin panel locally
    * Removes old files from the VPS
    * Uploads the new build
    * Fixes file permissions
    * Reloads Nginx

    **1- Deploy Command**<br/>
    From the `backend` folder, run:
    ```
    & "C:\Program Files\Git\bin\bash.exe" -lc "cd /c/Users/User/Desktop/Shopico/backend && ./deploy.sh"
    ```
    **2- Manual deploy**<br/>
    Build backend locally.<br>
    From the `backend` folder, run:
    ```
    npm run build
    ```
    This generates the compiled application inside `dist`<br>

    Clear old compiled files on the server<br>
    On the VPS run:
    ```
    rm -rf /var/www/shopico/backend/dist/*
    ```

    Then upload the `dist` folder to the server
    ```
    scp -r dist/* root@SERVER_IP:/var/www/shopico/backend/dist/
    ```
    Restart backend<br>
    on the VPS run:
    ```
    pm2 restart shopico-backend
    ```

    Verify backend status<br>
    on the VPS run:
    ```
    pm2 status
    ```

    View logs<br>
    on the VPS run:
    ```
    pm2 logs shopico-backend -2000