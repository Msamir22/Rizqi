import express from "express";
import { asyncHandler, Errors } from "../lib/errors";
import { getSupabaseClient } from "../lib/supabase";
import { AuthenticatedRequest } from "../middleware/auth";

const router = express.Router();

// GET /api/rates - Get cached rates
router.get(
  "/",
  asyncHandler<AuthenticatedRequest>(async (_req, res) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("market_rates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      throw Errors.supabaseError(error);
    }

    if (!data) {
      res.json({
        status: "success",
        data: null,
      });
      return;
    }

    res.json({
      status: "success",
      data,
    });
  })
);

export default router;
