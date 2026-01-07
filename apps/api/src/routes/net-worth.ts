import express from "express";
import { asyncHandler, Errors } from "../lib/errors";
import { getSupabaseClientAdmin } from "../lib/supabase";
import { AuthenticatedRequest } from "../middleware/auth";

const router = express.Router();

/**
 * GET /api/net-worth
 * Returns the user's current net worth calculated from the v_user_net_worth view
 */
router.get(
  "/",
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const supabase = getSupabaseClientAdmin();

    const { data, error } = await supabase
      .from("v_user_net_worth")
      .select("*")
      .eq("user_id", req.userId)
      .single();

    if (!data) {
      res.status(204).json({
        status: "success",
        data: null,
      });
      return;
    }

    if (error) {
      throw Errors.supabaseError(error);
    }

    res.json({
      status: "success",
      data,
    });
  })
);

export default router;
