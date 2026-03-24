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

echo "***** Starting Shopico admin deployment..."
echo

set -e
trap 'echo "${COLOR_RED}***** Deployment failed at line $LINENO: $BASH_COMMAND${COLOR_RESET}"' ERR

SERVER_IP="193.187.132.170"
REMOTE_PATH="/var/www/shopico/admin"
TOTAL_STEPS=5
CURRENT_STEP=0
CONTROL_PATH="/tmp/shopico-admin-deploy-%r@%h:%p"
SSH_OPTS=(-o ControlMaster=auto -o ControlPersist=10m -o ControlPath="$CONTROL_PATH")

step() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  echo "${COLOR_YELLOW}***** $CURRENT_STEP/$TOTAL_STEPS: $1${COLOR_RESET}"
}

cleanup_ssh_master() {
  ssh "${SSH_OPTS[@]}" -O exit root@"$SERVER_IP" >/dev/null 2>&1 || true
}

trap cleanup_ssh_master EXIT

step "Building project locally..."
npm run build

step "Opening SSH connection..."
ssh "${SSH_OPTS[@]}" -fN root@"$SERVER_IP"

step "Clearing old deployed files..."
ssh "${SSH_OPTS[@]}" root@"$SERVER_IP" "find $REMOTE_PATH -mindepth 1 -maxdepth 1 -exec rm -rf {} \;"

step "Copying new build files..."
scp "${SSH_OPTS[@]}" -r dist/* root@"$SERVER_IP":"$REMOTE_PATH"/

step "Fixing permissions and reloading nginx..."
ssh "${SSH_OPTS[@]}" root@"$SERVER_IP" "chown -R www-data:www-data $REMOTE_PATH && chmod -R 755 $REMOTE_PATH && systemctl reload nginx"

echo "${COLOR_GREEN}***** Shopico admin deployment complete!${COLOR_RESET}"
read -r -p "Press Enter to close..."
