#!/bin/bash

# Create placeholder files or ts-node script will fail
echo "{}" > ./src/context/_chains.json
echo "[]" > ./src/context/_tokens.json
echo "{}" > ./src/context/_routes.json

# Run actual build script
yarn ts-node src/scripts/buildConfigs/index.ts
