// Hedera network configuration derived from HEDERA_NETWORK env var
// Defaults to "testnet". Set HEDERA_NETWORK=mainnet for production
const NETWORK = (process.env.HEDERA_NETWORK || "testnet") as "testnet" | "mainnet";

export const hederaNetwork = NETWORK;
export const hashscanBase = `https://hashscan.io/${NETWORK}`;
export const mirrorNodeBase = `https://${NETWORK}.mirrornode.hedera.com/api/v1`;
