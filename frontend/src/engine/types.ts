export type StatusUpdate = {
  stage: string;
  message: string;
  current?: number;
  total?: number;
};

export type OnStatus = (status: StatusUpdate) => void;

export type SorobanTx = {
  txXdr: string;
  authEntries: string[];
  latestLedger?: number;
};

export type Prepared = { sorobanTx: SorobanTx };

export type SubmitFn = (proved: Prepared) => Promise<string>;

export interface WebClient {
  keyDerivationMessage(): string;
  deriveAndSaveUserKeys(account: string, signature: Uint8Array): Promise<void>;
  getUserKeys(account: string): Promise<{
    noteKeypair: { public: string };
    encryptionKeypair: { public: string };
  } | null>;
  getASPSecret(
    account: string,
  ): Promise<{ membershipBlinding?: string } | null>;
  getUserNotes(account: string, limit: number): Promise<unknown[] | null>;
  deriveAspUserLeaf(
    membershipBlinding: bigint,
    pubkeyHex: string,
  ): Promise<unknown>;
  executeDeposit(
    poolId: string,
    user: string,
    amount: bigint,
    outputAmounts: bigint[],
    submitFn: SubmitFn,
    onStatus?: OnStatus,
  ): Promise<string[]>;
  executeTransfer(
    poolId: string,
    user: string,
    amount: bigint,
    recipientNoteKey: string,
    recipientEncKey: string,
    submitFn: SubmitFn,
    onStatus: OnStatus | undefined,
    /**
     * `transact` sender: the relayer address on relayed calls, or the note
     * owner's own address when the wallet submits directly.
     */
    senderAddress: string,
  ): Promise<string[]>;
  executeWithdraw(
    poolId: string,
    user: string,
    recipient: string,
    amount: bigint,
    submitFn: SubmitFn,
    onStatus: OnStatus | undefined,
    /** `transact` sender — relayer address when relayed, note owner otherwise. */
    senderAddress: string,
  ): Promise<string[]>;
}

export type NoteRow = {
  amount: string | number | bigint | null;
  spent?: boolean;
  id?: string;
};

export type EngineHandle = { webClient: WebClient };
