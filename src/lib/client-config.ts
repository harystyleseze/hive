// Client-safe configuration using NEXT_PUBLIC_ env vars
const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || "testnet";

export const hashscanBase = `https://hashscan.io/${network}`;
