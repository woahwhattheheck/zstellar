export function deriveKeysFromWallet(
  account: string,
  opts: {
    onStatus?: (message: string) => void;
    signOptions?: Record<string, unknown>;
    skipCacheCheck?: boolean;
  },
): Promise<{
  pubKey: string;
  encryptionKeypair: { publicKey: string };
  aspSecret: string;
}>;
