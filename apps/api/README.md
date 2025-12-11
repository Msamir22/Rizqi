# Astik API Server

Express.js API server for Astik - provides metals.dev caching layer.

**Note:** All dependencies are managed in the root `package.json`.

## Endpoints

- `GET /api/rates` - Get cached metal & currency rates from Supabase
- `POST /api/rates/update` - Update rates from metals.dev (called by cron job)
- `GET /api/mock/rates` - Mock data for development

## Setup

From project root:

```bash
npm install
```

## Development

From project root:

```bash
npm run dev
```

Server runs on <http://localhost:3001>

## Production

From project root:

```bash
npm run build
npm start
```

## Environment Variables

See `.env.example` for required variables:

- Supabase credentials
- metals.dev API key
- Cron secret for `/api/rates/update` endpoint
