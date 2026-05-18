import { Platform } from "react-native";

const mockNativeSmsList = jest.fn();

jest.mock("react-native-get-sms-android", () => ({
  list: (...args: readonly unknown[]): unknown => mockNativeSmsList(...args),
}));

import { readSmsInbox } from "@/services/sms-reader-service";

const originalPlatformOS = Platform.OS;
const APRIL_8_2026_16_10 = 1775664600000;

describe("sms-reader-service", (): void => {
  beforeEach((): void => {
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_MONYVI_TEST_MODE;
    delete process.env.EXPO_PUBLIC_AI_SMS_PARSER_MODE;
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
  });

  afterEach((): void => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it("uses a stable timestamp fallback for invalid native SMS dates", async (): Promise<void> => {
    mockNativeSmsList.mockImplementation(
      (
        _filter: string,
        _onFail: (error: string) => void,
        onSuccess: (count: number, smsList: string) => void
      ) => {
        onSuccess(
          1,
          JSON.stringify([
            {
              _id: "10",
              address: "NBE",
              body: "Purchase EGP 100 at Shop",
              date: "not-a-date",
              read: 0,
            },
            {
              _id: "11",
              address: "NBE",
              body: "Purchase EGP 100 at Shop",
              date: "also-not-a-date",
              read: 0,
            },
          ])
        );
      }
    );

    const firstRead = await readSmsInbox();
    const secondRead = await readSmsInbox();

    expect(firstRead[0]?.date).toBeGreaterThan(Date.UTC(2024, 0, 1) - 1);
    expect(firstRead[1]?.date).toBeGreaterThan(firstRead[0]?.date ?? 0);
    expect(secondRead.map((message) => message.date)).toEqual(
      firstRead.map((message) => message.date)
    );
  });

  it("uses deterministic fixture inbox messages in E2E fixture mode", async (): Promise<void> => {
    process.env.EXPO_PUBLIC_MONYVI_TEST_MODE = "e2e";
    process.env.EXPO_PUBLIC_AI_SMS_PARSER_MODE = "fixture";

    const messages = await readSmsInbox();

    expect(mockNativeSmsList).not.toHaveBeenCalled();
    expect(messages).toHaveLength(3);
    expect(messages.map((message) => message.body)).toEqual([
      "Purchase EGP 33.33 on card **** 4321 at PR622 BATCH DUPLICATE SHOP on 08/04 17:01. Avail bal EGP 12,397.22",
      "Purchase EGP 33.33 on card **** 4321 at PR622 BATCH DUPLICATE SHOP on 08/04 17:01. Avail bal EGP 12,397.22",
      "QNB Alahli: ATM cash withdrawal EGP 2,000.00 from card **** 5566 on 08/04/2026 15:02. Avail bal EGP 8,000.00",
    ]);
    expect(messages[0]?.date).not.toBe(messages[1]?.date);
    expect(messages[0]?.date).toBeGreaterThan(messages[1]?.date ?? 0);
    expect(messages[1]?.date).toBeGreaterThan(messages[2]?.date ?? 0);
  });

  it("applies fixture inbox maxCount after native-like newest-first ordering", async (): Promise<void> => {
    process.env.EXPO_PUBLIC_MONYVI_TEST_MODE = "e2e";
    process.env.EXPO_PUBLIC_AI_SMS_PARSER_MODE = "fixture";

    const messages = await readSmsInbox({ maxCount: 1 });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: "e2e-pr622_batch_duplicate_shop-1",
      address: "NBE",
      body: "Purchase EGP 33.33 on card **** 4321 at PR622 BATCH DUPLICATE SHOP on 08/04 17:01. Avail bal EGP 12,397.22",
    });
  });

  it("keeps the fixture inbox disabled on iOS", async (): Promise<void> => {
    process.env.EXPO_PUBLIC_MONYVI_TEST_MODE = "e2e";
    process.env.EXPO_PUBLIC_AI_SMS_PARSER_MODE = "fixture";
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "ios",
    });

    const messages = await readSmsInbox();

    expect(mockNativeSmsList).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
  });

  it("applies fixture inbox sender and scan-window filters", async (): Promise<void> => {
    process.env.EXPO_PUBLIC_MONYVI_TEST_MODE = "e2e";
    process.env.EXPO_PUBLIC_AI_SMS_PARSER_MODE = "fixture";

    const messages = await readSmsInbox({
      address: "NBE",
      minDate: APRIL_8_2026_16_10,
    });

    expect(messages).toHaveLength(2);
    expect(messages.every((message) => message.address === "NBE")).toBe(true);
    expect(
      messages.every((message) => message.date >= APRIL_8_2026_16_10)
    ).toBe(true);
  });

  it("keeps fixture timestamps stable when scans use minDate filters", async (): Promise<void> => {
    process.env.EXPO_PUBLIC_MONYVI_TEST_MODE = "e2e";
    process.env.EXPO_PUBLIC_AI_SMS_PARSER_MODE = "fixture";

    const firstScan = await readSmsInbox();
    const filteredScan = await readSmsInbox({
      minDate: APRIL_8_2026_16_10,
    });
    const firstDuplicate = firstScan.find(
      (message) => message.id === "e2e-pr622_batch_duplicate_shop-1"
    );
    const filteredDuplicate = filteredScan.find(
      (message) => message.id === "e2e-pr622_batch_duplicate_shop-1"
    );

    expect(filteredDuplicate?.date).toBe(firstDuplicate?.date);
  });
});
