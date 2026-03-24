#!/bin/bash
set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Install Node.js 22 if needed
if ! command -v node &> /dev/null; then
  echo "Installing Node.js 22 LTS..."
  nvm install 22
  nvm use 22
fi

echo "Node: $(node -v)"
echo "npm: $(npm -v)"

# Build Angular
cd /mnt/d/projects/pneuma-pos/front
echo "Installing dependencies..."
npm ci
echo "Building Angular for production..."
npx ng build --configuration=production

echo ""
echo "✅ Build complete!"
ls -la /mnt/d/projects/pneuma-pos/front/dist/pneuma-pos/browser/ | head -20
