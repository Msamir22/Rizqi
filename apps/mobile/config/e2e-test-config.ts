export type MonyviTestMode = "off" | "e2e";
export type AiSmsParserMode = "edge" | "fixture";

type PublicEnvName =
  | "EXPO_PUBLIC_MONYVI_TEST_MODE"
  | "EXPO_PUBLIC_AI_SMS_PARSER_MODE";

interface TestProcessEnv {
  readonly NODE_ENV?: string;
  readonly EXPO_PUBLIC_MONYVI_TEST_MODE?: string;
  readonly EXPO_PUBLIC_AI_SMS_PARSER_MODE?: string;
}

interface TestGlobal {
  readonly process?: {
    readonly env: TestProcessEnv;
  };
}

function getTestEnvValue(name: PublicEnvName): string | undefined {
  const testGlobal = globalThis as typeof globalThis & TestGlobal;
  return testGlobal.process?.env[name];
}

function getPublicMonyviTestModeEnv(): string | undefined {
  return getTestEnvValue("EXPO_PUBLIC_MONYVI_TEST_MODE");
}

function getPublicAiSmsParserModeEnv(): string | undefined {
  return getTestEnvValue("EXPO_PUBLIC_AI_SMS_PARSER_MODE");
}

export function getMonyviTestMode(): MonyviTestMode {
  return getPublicMonyviTestModeEnv() === "e2e" ? "e2e" : "off";
}

export function getAiSmsParserMode(): AiSmsParserMode {
  return getPublicAiSmsParserModeEnv() === "fixture" ? "fixture" : "edge";
}

export function isE2eTestMode(): boolean {
  return getMonyviTestMode() === "e2e";
}

export function shouldUseFixtureSmsParser(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    isE2eTestMode() &&
    getAiSmsParserMode() === "fixture"
  );
}
