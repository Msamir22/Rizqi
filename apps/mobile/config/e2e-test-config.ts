export type MonyviTestMode = "off" | "e2e";
export type AiSmsParserMode = "edge" | "fixture";

const publicMonyviTestModeEnv = process.env
  .EXPO_PUBLIC_MONYVI_TEST_MODE as string | undefined;
const publicAiSmsParserModeEnv = process.env
  .EXPO_PUBLIC_AI_SMS_PARSER_MODE as string | undefined;

function getTestProcessEnv(): Record<string, string | undefined> | undefined {
  return globalThis.process?.env as
    | Record<string, string | undefined>
    | undefined;
}

function getPublicMonyviTestModeEnv(): string | undefined {
  if (process.env.NODE_ENV === "test") {
    return getTestProcessEnv()?.EXPO_PUBLIC_MONYVI_TEST_MODE;
  }

  return publicMonyviTestModeEnv;
}

function getPublicAiSmsParserModeEnv(): string | undefined {
  if (process.env.NODE_ENV === "test") {
    return getTestProcessEnv()?.EXPO_PUBLIC_AI_SMS_PARSER_MODE;
  }

  return publicAiSmsParserModeEnv;
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
