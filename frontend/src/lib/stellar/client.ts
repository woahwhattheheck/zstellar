import { Horizon, rpc } from "@stellar/stellar-sdk";
import { browserRpcUrl, STELLAR } from "./config";

const rpcUrl = browserRpcUrl();
export const server = new rpc.Server(rpcUrl, {
  allowHttp: !rpcUrl.startsWith("https://"),
});
export const horizon = new Horizon.Server(STELLAR.horizonUrl);

export async function fundWithFriendbot(address: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`,
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function getXlmBalance(address: string): Promise<string> {
  try {
    const account = await horizon.loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native?.balance ?? "0";
  } catch {
    return "0";
  }
}
