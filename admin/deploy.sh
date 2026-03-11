#!/bin/bash
echo "***** Starting Shopico admin deployment..."

set -e

SERVER_IP="193.187.132.170"
REMOTE_PATH="/var/www/shopico/admin"

echo "***** Building project locally..."
npm run build

echo "***** Clearing old deployed files..."
ssh root@$SERVER_IP "find $REMOTE_PATH -mindepth 1 -maxdepth 1 -exec rm -rf {} \;"

echo "***** Copying new build files..."
scp -r dist/* root@$SERVER_IP:$REMOTE_PATH/

echo "***** Fixing permissions..."
ssh root@$SERVER_IP "chown -R www-data:www-data $REMOTE_PATH && chmod -R 755 $REMOTE_PATH"

echo "***** Reloading nginx..."
ssh root@$SERVER_IP "systemctl reload nginx"

echo "***** Shopico admin deployment complete!"