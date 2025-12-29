# Zuora Catalog Import Script

Imports product catalog data from **Zuora** into **Stigg** by converting Zuora products, rate plans, and charges into Stigg products, plans, add-ons, and prices via the Stigg GraphQL API.

---

## Features

- Imports Zuora products, plans, add-ons, and flat-rate prices into Stigg
- Automatically detects add-ons (`add-on` / `addon` in name)
- Supports **create**, **update**, and **publish** workflows
- Dry-run mode to preview changes without modifying Stigg

---

## How It Works

- The **first Zuora product** becomes the main product in Stigg
- All plans and add-ons from additional products are assigned to it
- Rate plans are split into **plans** and **add-ons**
- Only **flat-rate pricing** is supported
- Entities are created as **draft** by default

---

## Requirements

- Node.js
- Yarn or NPM

---

## Setup

Use the provided `.env.example` file as a template:

```bash
cp .env.example .env
```

Update the values in `.env`:

```bash
X_API_KEY=your-stigg-api-server-key
ENVIRONMENT_ID=your-stigg-environment-id
ZUORA_PRODUCT_IDS=zuoraProductId1,zuoraProductId2
```

---

## Install

```bash
yarn install
```

---

## Usage

### Default import

```bash
yarn run zuora-import
```

- Creates **new entities only**
- All entities are created as **draft**

---

### Update mode

```bash
yarn run zuora-import --update
```

- Creates **new entities** if they don’t exist
- Updates **existing entities**
- Does **not** publish

---

### Publish mode

```bash
yarn run zuora-import --publish
```

- Creates **new entities** if they don’t exist
- Publishes **all unpublished entities**
- Does **not** update existing published entities

---

### Update + Publish

```bash
yarn run zuora-import --update --publish
```

- Creates **new entities**
- Updates **existing entities**
- Publishes **all unpublished entities**

---

### Dry-run mode (combinable with any flags)

```bash
yarn run zuora-import --dry-run
yarn run zuora-import --update --dry-run
yarn run zuora-import --publish --dry-run
yarn run zuora-import --update --publish --dry-run
```

- **No changes are applied to Stigg**
- All actions are **previewed in the console only**
