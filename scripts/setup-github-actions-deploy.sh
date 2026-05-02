#!/bin/bash
# Setup script for GitHub Actions deployment
# This script helps you set up SSH keys and configure GitHub secrets

set -e

echo "🚀 GitHub Actions Deployment Setup"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if SSH key already exists
SSH_KEY_PATH="$HOME/.ssh/github_actions_deploy"
if [ -f "$SSH_KEY_PATH" ]; then
    echo -e "${YELLOW}⚠️  SSH key already exists at $SSH_KEY_PATH${NC}"
    read -p "Do you want to generate a new one? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Using existing key..."
    else
        rm -f "$SSH_KEY_PATH" "$SSH_KEY_PATH.pub"
        ssh-keygen -t ed25519 -C "github-actions-deploy" -f "$SSH_KEY_PATH" -N ""
        echo -e "${GREEN}✅ New SSH key generated${NC}"
    fi
else
    echo "Generating SSH key pair..."
    ssh-keygen -t ed25519 -C "github-actions-deploy" -f "$SSH_KEY_PATH" -N ""
    echo -e "${GREEN}✅ SSH key generated${NC}"
fi

# Display public key
echo ""
echo -e "${GREEN}📋 Your public key:${NC}"
echo "=================================="
cat "$SSH_KEY_PATH.pub"
echo "=================================="
echo ""

# Instructions
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo ""
echo "1. Add the public key above to your OCI instance:"
echo "   ssh-copy-id -i $SSH_KEY_PATH.pub ubuntu@YOUR_OCI_IP"
echo "   OR manually add to ~/.ssh/authorized_keys on OCI instance"
echo ""
echo "2. Test SSH connection:"
echo "   ssh -i $SSH_KEY_PATH ubuntu@YOUR_OCI_IP"
echo ""
echo "3. Add GitHub Secrets (go to: Settings → Secrets and variables → Actions):"
echo ""
echo -e "${GREEN}   Secret 1: SSH_PRIVATE_KEY${NC}"
echo "   Value: (copy entire private key below)"
echo "   ----------------------------------------"
cat "$SSH_KEY_PATH"
echo "   ----------------------------------------"
echo ""
echo -e "${GREEN}   Secret 2: SERVER_HOST${NC}"
read -p "   Enter your OCI instance IP or hostname: " SERVER_HOST
echo "   Value: $SERVER_HOST"
echo ""
echo -e "${GREEN}   Secret 3: SERVER_USER${NC}"
read -p "   Enter your SSH username (default: ubuntu): " SERVER_USER
SERVER_USER=${SERVER_USER:-ubuntu}
echo "   Value: $SERVER_USER"
echo ""

# Verify OCI setup
echo -e "${YELLOW}🔍 Verify OCI Instance Setup:${NC}"
echo ""
echo "Make sure on your OCI instance:"
echo "  ✓ Project exists at ~/cortex"
echo "  ✓ .env file exists at ~/cortex/.env"
echo "  ✓ Git repository is initialized"
echo ""

read -p "Do you want to test the SSH connection now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Testing SSH connection..."
    if ssh -i "$SSH_KEY_PATH" -o ConnectTimeout=5 "$SERVER_USER@$SERVER_HOST" "echo 'SSH connection successful!'"; then
        echo -e "${GREEN}✅ SSH connection successful!${NC}"
    else
        echo -e "${RED}❌ SSH connection failed. Make sure:${NC}"
        echo "  1. Public key is added to ~/.ssh/authorized_keys on OCI instance"
        echo "  2. OCI instance IP is correct"
        echo "  3. SSH username is correct"
        echo "  4. OCI security rules allow SSH (port 22)"
    fi
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "After adding GitHub secrets, push to main branch to trigger deployment."

