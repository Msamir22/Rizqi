/**
 * Astik API Server - Express.js
 *
 * IMPORTANT: Environment variables must be loaded before importing routes
 * because routes/rates.ts creates Supabase clients at module load time
 */

import dotenv from "dotenv";
import { existsSync } from "fs";
import path from "path";

const envPath = path.resolve(__dirname, "../.env.local");
if (!existsSync(envPath)) {
  console.error("❌ Error: .env.local file not found!");
  console.error(`   Expected location: ${envPath}`);
  console.error("   Please create this file from .env.example");
  process.exit(1);
}

dotenv.config({ path: envPath });

// Validate environment variables
const requiredEnvVars = [
  "EXPRESS_PUBLIC_SUPABASE_URL",
  "EXPRESS_PUBLIC_SUPABASE_ANON_KEY",
  "EXPRESS_SUPABASE_SERVICE_ROLE_KEY",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingVars.forEach((varName) => console.error(`   - ${varName}`));
  console.error("\n   Please add them to apps/api/.env.local");
  process.exit(1);
}

// NOW it's safe to import routes (they can access env vars)
import cors from "cors";
import express from "express";
import { globalErrorHandler } from "./lib/errors";
import { Auth } from "./middleware/auth";
import ratesRouter from "./routes/market-rates";
import mockRouter from "./routes/mock";
import netWorthRouter from "./routes/net-worth";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

app.use(Auth);

// Routes
app.use("/api/market-rates", ratesRouter);
app.use("/api/mock", mockRouter);
app.use("/api/net-worth", netWorthRouter);

// Health check
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "Astik API Server",
    endpoints: [
      "GET /api/rates - Get cached metal & currency rates",
      "POST /api/rates/update - Update rates from metals.dev (cron only)",
      "GET /api/net-worth - Get user's net worth (requires auth)",
      "GET /api/mock/rates - Mock data for development",
    ],
  });
});

// Global error handler (must be last)
app.use(globalErrorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Astik API server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `✅ Supabase connected: ${process.env.EXPRESS_PUBLIC_SUPABASE_URL}`
  );
});

export default app;
