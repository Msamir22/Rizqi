/**
 * Astik API Server - Express.js
 * Provides metals.dev caching layer for mobile app
 *
 * IMPORTANT: Environment variables must be loaded before importing routes
 * because routes/rates.ts creates Supabase clients at module load time
 */

// Step 1: Load dotenv and path modules (no env vars needed yet)
import dotenv from "dotenv";
import path from "path";
import { existsSync } from "fs";

// Step 2: Load environment variables BEFORE importing anything else
const envPath = path.resolve(__dirname, "../.env.local");
if (!existsSync(envPath)) {
  console.error("❌ Error: .env.local file not found!");
  console.error(`   Expected location: ${envPath}`);
  console.error("   Please create this file from .env.example");
  process.exit(1);
}

dotenv.config({ path: envPath });

// Step 3: Validate environment variables
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

// Step 4: NOW it's safe to import routes (they can access env vars)
import express from "express";
import cors from "cors";
import ratesRouter from "./routes/rates";
import mockRouter from "./routes/mock";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/rates", ratesRouter);
app.use("/api/mock", mockRouter);

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Astik API Server",
    endpoints: [
      "GET /api/rates - Get cached metal & currency rates",
      "POST /api/rates/update - Update rates from metals.dev (cron only)",
      "GET /api/mock/rates - Mock data for development",
    ],
  });
});

// Error handling
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Astik API server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `✅ Supabase connected: ${process.env.EXPRESS_PUBLIC_SUPABASE_URL}`
  );
});

export default app;
