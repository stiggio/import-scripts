## Zuora Catalog Import Script

## Overview

This script imports product catalog data from Zuora into Stigg. It connects to the Stigg GraphQL API, retrieves catalog entities such as products, rate plans, and charges from Zuora, and converts them into the appropriate Stigg mutations. The tool simplifies catalog synchronization and ensures your Stigg environment always reflects the latest product configuration from Zuora.

## Features

- Securely connects to the Stigg API using the provided API server key.
- Fetches products, rate plans, and charges from Zuora through Stigg.
- Transforms and structures the retrieved information into multiple GraphQL mutations for importing into Stigg.
- Supports hierarchical mapping (product → product, plan → plan, charge → price).
- Includes a dry-run mode to preview changes without performing an actual import.

## Usage

1. Provide the required credentials in a `.env` file:

   - `BASE_URL` – Base URL for connecting to Stigg
   - `X_API_KEY` – Stigg API server key
   - `ZUORA_PRODUCT_ID` – Product name or ID (full or partial match). Can also be passed as a CLI argument
   - `ENVIRONMENT_ID` – Stigg environment ID (can also be passed as a CLI argument)

2. Run the script to begin the import process. Use the `--dry-run` flag to validate the output before performing the actual import.

3. Review the logs and output for errors or important details.

## Requirements

- Node.js
- NPM

## Env file Example

Create .env file with credentials and needed variables

```bash
# -----------------------------------------
# Stigg Configuration
# -----------------------------------------

# Stigg API server key
X_API_KEY=your-stigg-api-server-key

# Target Stigg environment ID (can be overridden via CLI)
ENVIRONMENT_ID=your-stigg-environment-id

# -----------------------------------------
# Zuora Configuration
# -----------------------------------------

# Zuora product identifier (name or ID; supports partial match)
# Can also be provided via CLI
ZUORA_PRODUCT_ID=your-zuora-product-id-or-name
```

## Usage

```bash
yarn install
yarn run zuora-import --dry-run

```
