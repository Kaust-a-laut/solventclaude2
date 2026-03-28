#!/bin/bash
cd "$(dirname "$0")/../backend"
NODE_ENV=development exec npx tsx src/server.ts
