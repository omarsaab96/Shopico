#!/bin/bash

if [[ -t 1 ]]; then
  COLOR_RED=$'\033[0;31m'
  COLOR_GREEN=$'\033[0;32m'
  COLOR_YELLOW=$'\033[38;2;255;204;0m'
  COLOR_RESET=$'\033[0m'
else
  COLOR_RED=""
  COLOR_GREEN=""
  COLOR_YELLOW=""
  COLOR_RESET=""
fi

echo "***** Starting Shopico backend deployment..."
echo

set -e
trap 'echo "${COLOR_RED}***** Deployment failed at line $LINENO: $BASH_COMMAND${COLOR_RESET}"' ERR

SERVER_IP="193.187.132.170"
REMOTE_ROOT="/var/www/shopico/backend"
REMOTE_DIST="$REMOTE_ROOT/dist"
PM2_NAME="shopico-backend"
PORT="4002"
HEALTHCHECK_PATH="/api/branches/public"
TOTAL_STEPS=8
CURRENT_STEP=0
DEPLOY_EXIT_CODE=0

step() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  echo "${COLOR_YELLOW}***** $CURRENT_STEP/$TOTAL_STEPS: $1${COLOR_RESET}"
}

step "Building backend locally..."
npm run build

step "Clearing remote dist folder..."
ssh root@$SERVER_IP "rm -rf $REMOTE_DIST/*"

step "Uploading package files..."
scp package.json root@$SERVER_IP:$REMOTE_ROOT/
scp package-lock.json root@$SERVER_IP:$REMOTE_ROOT/

step "Uploading new backend build..."
scp -r dist/* root@$SERVER_IP:$REMOTE_DIST/

step "Installing dependencies on server..."
ssh root@$SERVER_IP "cd $REMOTE_ROOT && npm install"

step "Restarting PM2 process..."
ssh root@$SERVER_IP "pm2 restart $PM2_NAME"

step "Saving PM2 process list..."
ssh root@$SERVER_IP "pm2 save"

step "Verifying backend is responding on port $PORT..."
if ssh root@$SERVER_IP "curl -f -s http://127.0.0.1:$PORT$HEALTHCHECK_PATH > /dev/null"; then
  echo "${COLOR_GREEN}***** Backend is responding on port $PORT${COLOR_RESET}"
else
  echo "${COLOR_RED}***** Backend is not responding on port $PORT${COLOR_RESET}"
  DEPLOY_EXIT_CODE=1
fi

if [ "$DEPLOY_EXIT_CODE" -eq 0 ]; then
  echo "${COLOR_GREEN}***** Shopico backend deployment complete!${COLOR_RESET}"
fi
read -r -p "Press Enter to close..."
exit "$DEPLOY_EXIT_CODE"
