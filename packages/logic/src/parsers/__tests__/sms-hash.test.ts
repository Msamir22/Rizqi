import * as Crypto from "expo-crypto";
import { computeSmsFingerprint, normalizeSmsBody } from "../sms-hash";

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(),
}));

const mockDigestStringAsync = jest.mocked(Crypto.digestStringAsync);

describe("sms-hash", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normalizes whitespace and invisible characters before fingerprinting", () => {
    expect(normalizeSmsBody("  Debit\u200BEGP\r\n100\t\tat Shop  ")).toBe(
      "DebitEGP 100 at Shop"
    );
  });

  it("fingerprints sender, normalized body, and received timestamp", async () => {
    mockDigestStringAsync.mockResolvedValue("fingerprint-1");

    await computeSmsFingerprint({
      sender: "  QNB  ",
      body: "Debit EGP\r\n100",
      receivedAtMs: 1778414400000,
    });

    expect(mockDigestStringAsync).toHaveBeenCalledWith(
      "SHA-256",
      JSON.stringify({
        sender: "qnb",
        body: "Debit EGP 100",
        receivedAtMs: 1778414400000,
      })
    );
  });

  it("keeps identical SMS text distinct when received at different times", async () => {
    mockDigestStringAsync.mockImplementation((_algorithm, value) =>
      Promise.resolve(value)
    );

    const first = await computeSmsFingerprint({
      sender: "QNB",
      body: "Debit EGP 100 at Shop",
      receivedAtMs: 1778414400000,
    });
    const second = await computeSmsFingerprint({
      sender: "QNB",
      body: "Debit EGP 100 at Shop",
      receivedAtMs: 1778418000000,
    });

    expect(first).not.toBe(second);
  });
});
