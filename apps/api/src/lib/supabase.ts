import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SupabaseDatabase } from "@astik/db";

export type TypedSubapaseClient = SupabaseClient<SupabaseDatabase>;

let supabase: TypedSubapaseClient | null = null;
let supabaseAdmin: TypedSubapaseClient | null = null;

/**
 * Get Supabase client that respects RLS
 * Use for user-facing operations
 */
export function getSupabaseClient(): TypedSubapaseClient {
  if (!supabase) {
    supabase = createClient<SupabaseDatabase>(
      process.env.EXPRESS_PUBLIC_SUPABASE_URL!,
      process.env.EXPRESS_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabase;
}
/**
 * Get Supabase admin client that bypasses RLS
 * Use for server-side admin operations only
 */
export function getSupabaseClientAdmin(): TypedSubapaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient<SupabaseDatabase>(
      process.env.EXPRESS_PUBLIC_SUPABASE_URL!,
      process.env.EXPRESS_SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabaseAdmin;
}
