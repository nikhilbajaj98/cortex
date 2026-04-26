#!/bin/bash
# Setup script for GitHub Actions deployment
# Run this on your OCI instance to prepare for automated deployments

set -e

echo "🚀 Setting up GitHub Actions deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Please do not run as root${NC}"
   exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

# Check if user is in docker group
if ! groups | grep -q docker; then
    echo -e "${YELLOW}⚠️  User not in docker group. Adding...${NC}"
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✅ Added to docker group. Please log out and log back in for changes to take effect.${NC}"
    echo -e "${YELLOW}Or run: newgrp docker${NC}"
fi

# Check if project directory exists
if [ ! -d ~/cortex ]; then
    echo -e "${YELLOW}⚠️  ~/cortex directory not found${NC}"
    read -p "Do you want to create it and clone the repo? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your GitHub repository URL: " REPO_URL
        mkdir -p ~/cortex
        cd ~/cortex
        git clone $REPO_URL .
        echo -e "${GREEN}✅ Repository cloned${NC}"
    else
        echo -e "${RED}❌ Please create ~/cortex directory and clone your repo${NC}"
        exit 1
    fi
fi

cd ~/cortex

# Check if .env or .env.prod exists
if [ ! -f .env ] && [ ! -f .env.prod ]; then
    echo -e "${YELLOW}⚠️  No .env or .env.prod file found${NC}"
    echo -e "${YELLOW}Please create one with your environment variables${NC}"
    echo -e "${YELLOW}See documentation/production-env-setup.md for details${NC}"
fi

# Setup SSH directory
echo -e "${GREEN}📁 Setting up SSH directory...${NC}"
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Check if authorized_keys exists
if [ ! -f ~/.ssh/authorized_keys ]; then
    touch ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
    echo -e "${GREEN}✅ Created authorized_keys file${NC}"
else
    chmod 600 ~/.ssh/authorized_keys
    echo -e "${GREEN}✅ authorized_keys file exists${NC}"
fi

# Instructions for adding SSH key
echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo ""
echo "1. Generate SSH key pair on your local machine:"
echo "   ssh-keygen -t ed25519 -C 'github-actions-deploy' -f ~/.ssh/github_actions_deploy"
echo ""
echo "2. Add the public key to this server:"
echo "   cat ~/.ssh/github_actions_deploy.pub | ssh $USER@$(hostname -I | awk '{print $1}') 'cat >> ~/.ssh/authorized_keys'"
echo ""
echo "3. Add GitHub secrets:"
echo "   - SSH_PRIVATE_KEY: Contents of ~/.ssh/github_actions_deploy"
echo "   - SERVER_HOST: $(hostname -I | awk '{print $1}')"
echo "   - SERVER_USER: $USER"
echo ""
echo "4. Test the workflow by pushing to main branch"
echo ""
echo -e "${GREEN}📚 See documentation/github-actions-setup.md for detailed instructions${NC}"

