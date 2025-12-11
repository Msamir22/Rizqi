/**
 * Rates API Routes
 * GET /api/rates - Get cached rates from Supabase
 * POST /api/rates/update - Fetch from metals.dev and update cache
 */

import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// Helper function to get Supabase client (lazy initialization)
function getSupabaseClient() {
  return createClient(
    process.env.EXPRESS_PUBLIC_SUPABASE_URL!,
    process.env.EXPRESS_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper function to get Supabase admin client (lazy initialization)
function getSupabaseAdminClient() {
  return createClient(
    process.env.EXPRESS_PUBLIC_SUPABASE_URL!,
    process.env.EXPRESS_SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/rates - Get cached rates
router.get("/", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("market_rates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to fetch rates" });
    }

    if (!data) {
      return res.status(404).json({ error: "No rates found" });
    }

    res.json({
      status: "success",
      currency: "USD",
      unit: "toz",
      metals: data.metals,
      currencies: data.currencies,
      timestamp: data.timestamp,
    });
  } catch (error) {
    console.error("Error fetching rates:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/rates/update - Update rates from metals.dev
router.post("/update", async (req, res) => {
  // Verify cron secret
  const cronSecret = req.headers["x-cron-secret"];
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Fetch from metals.dev
    const response = await fetch(
      `https://api.metals.dev/v1/latest?api_key=${process.env.METALS_DEV_API_KEY}&currency=USD&unit=toz`
    );

    if (!response.ok) {
      throw new Error(`metals.dev API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Update Supabase
    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from("market_rates").upsert({
      id: 1,
      metals: data.metals,
      currencies: data.currencies,
      timestamp: data.timestamp,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to update rates" });
    }

    res.json({
      success: true,
      message: "Rates updated successfully",
      timestamp: data.timestamp,
    });
  } catch (error) {
    console.error("Error updating rates:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
