#!/bin/bash
echo "***** Starting Shopico backend deployment..."

set -e

SERVER_IP="193.187.132.170"
REMOTE_ROOT="/var/www/shopico/backend"
REMOTE_DIST="$REMOTE_ROOT/dist"
PM2_NAME="shopico-backend"
PORT="4002"

echo "***** Building backend locally..."
npm run build

echo "***** Clearing remote dist folder..."
ssh root@$SERVER_IP "rm -rf $REMOTE_DIST/*"

echo "***** Uploading package files..."
scp package.json root@$SERVER_IP:$REMOTE_ROOT/
scp package-lock.json root@$SERVER_IP:$REMOTE_ROOT/

echo "***** Uploading new backend build..."
scp -r dist/* root@$SERVER_IP:$REMOTE_DIST/

echo "***** Installing dependencies on server..."
ssh root@$SERVER_IP "cd $REMOTE_ROOT && npm install"

echo "***** Restarting PM2 process..."
ssh root@$SERVER_IP "pm2 restart $PM2_NAME"

echo "***** Saving PM2 process list..."
ssh root@$SERVER_IP "pm2 save"

echo "***** Verifying backend is responding on port $PORT..."
ssh root@$SERVER_IP "curl -f -s http://127.0.0.1:$PORT > /dev/null"

echo "***** Shopico backend deployment complete!"