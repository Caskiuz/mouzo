#!/bin/bash
export NODE_ENV=production
export PORT=5000
exec npx tsx server/server.ts
