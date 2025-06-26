#!/bin/bash

# Chat99 Deployment Script for Render.com
echo "🚀 Deploying Chat99..."

# Install server dependencies
cd server
npm install

# Start the server
npm start