export interface E2eSeedConfig {
  readonly mode: "local" | "remote";
  readonly supabaseUrl: string;
  readonly appSupabaseUrl: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
  readonly email: string;
  readonly password: string;
  readonly userId?: string;
}

export const E2E_TABLE_DELETE_ORDER: readonly string[];

export function getE2eSeedConfig(
  env?: Record<string, string | undefined>
): E2eSeedConfig;

export function seedE2eData(
  client: unknown,
  config: E2eSeedConfig
): Promise<{ readonly userId: string }>;

export function resetE2eData(
  client: unknown,
  config: E2eSeedConfig
): Promise<{ readonly userId: string }>;
