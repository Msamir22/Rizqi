import { Platform } from "react-native";

const mockNativeSmsList = jest.fn();

jest.mock("react-native-get-sms-android", () => ({
  list: (...args: readonly unknown[]): unknown => mockNativeSmsList(...args),
}));

import { readSmsInbox } from "@/services/sms-reader-service";

const originalPlatformOS = Platform.OS;

describe("sms-reader-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_MONYVI_TEST_MODE;
    delete process.env.EXPO_PUBLIC_AI_SMS_PARSER_MODE;
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it("uses a stable timestamp fallback for invalid native SMS dates", async () => {
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
              _id: "sms-1",
              address: "NBE",
              body: "Purchase EGP 100 at Shop",
              date: "not-a-date",
              read: 0,
            },
          ])
        );
      }
    );

    const firstRead = await readSmsInbox();
    const secondRead = await readSmsInbox();

    expect(firstRead[0]?.date).toBe(0);
    expect(secondRead[0]?.date).toBe(0);
  });

  it("uses deterministic fixture inbox messages in E2E fixture mode", async () => {
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
  });
});
