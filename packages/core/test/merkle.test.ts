import { describe, expect, it } from "vitest";
import { buildEpochTree, epochLeaves, epochRoot, proofFor, serializeSnapshot, verifyLeaf } from "../src";

const allocs = [
  { address: "0x000000000000000000000000000000000000000A", twab: 300n, balanceSeconds: 30000n, sharePpm: 750000, kwotaMicro: 750n },
  { address: "0x000000000000000000000000000000000000000b", twab: 100n, balanceSeconds: 10000n, sharePpm: 250000, kwotaMicro: 250n },
];

describe("epoch merkle", () => {
  it("builds verifiable proofs", () => {
    const tree = buildEpochTree(7, allocs);
    const leaves = epochLeaves(7, allocs);
    const proof = proofFor(tree, allocs[0]!.address)!;
    expect(verifyLeaf(tree.root, leaves[0]!, proof)).toBe(true);
    expect(verifyLeaf(tree.root, ["7", leaves[0]![1], "300", "751"], proof)).toBe(false);
  });
  it("root is stable and epoch-bound", () => {
    expect(epochRoot(7, allocs)).toBe(epochRoot(7, allocs));
    expect(epochRoot(7, allocs)).not.toBe(epochRoot(8, allocs));
    expect(epochRoot(1, [])).toBeNull();
  });
  it("snapshot hash is deterministic", () => {
    const snap = {
      version: 1 as const, chainId: 46630, token: "0x0", epochId: 1, start: 0, end: 1, startBlock: "0", endBlock: "1",
      budgetMicro: "0", distributedMicro: "0", dustMicro: "0", totalWeight: "0", params: {}, excluded: [], merkleRoot: null, allocations: [],
    };
    expect(serializeSnapshot(snap).sha256).toBe(serializeSnapshot({ ...snap }).sha256);
  });
});
