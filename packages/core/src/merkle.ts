import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { sha256, toHex } from "viem";
import type { HolderAllocation } from "./epoch";

/** Leaf: (uint256 epochId, address holder, uint256 twab, uint256 kwotaMicro) — OZ StandardMerkleTree encoding. */
export const LEAF_ENCODING = ["uint256", "address", "uint256", "uint256"] as const;
export type EpochLeaf = [string, string, string, string];

export function epochLeaves(epochId: number | bigint, allocations: HolderAllocation[]): EpochLeaf[] {
  return allocations.map((a) => [
    BigInt(epochId).toString(),
    a.address.toLowerCase(),
    a.twab.toString(),
    a.kwotaMicro.toString(),
  ]);
}

export function buildEpochTree(epochId: number | bigint, allocations: HolderAllocation[]) {
  return StandardMerkleTree.of(epochLeaves(epochId, allocations), [...LEAF_ENCODING]);
}

export function epochRoot(epochId: number | bigint, allocations: HolderAllocation[]): `0x${string}` | null {
  if (allocations.length === 0) return null;
  return buildEpochTree(epochId, allocations).root as `0x${string}`;
}

export function proofFor(tree: StandardMerkleTree<EpochLeaf>, address: string): string[] | null {
  const a = address.toLowerCase();
  for (const [i, v] of tree.entries()) if (v[1] === a) return tree.getProof(i);
  return null;
}

export function verifyLeaf(root: string, leaf: EpochLeaf, proof: string[]): boolean {
  return StandardMerkleTree.verify(root, [...LEAF_ENCODING], leaf, proof);
}

export interface EpochSnapshot {
  version: 1;
  chainId: number;
  token: string;
  epochId: number;
  start: number;
  end: number;
  startBlock: string;
  endBlock: string;
  budgetMicro: string;
  distributedMicro: string;
  dustMicro: string;
  totalWeight: string;
  params: Record<string, unknown>;
  excluded: string[];
  merkleRoot: string | null;
  allocations: { address: string; twab: string; balanceSeconds: string; sharePpm: number; kwotaMicro: string }[];
}

/** Canonical JSON (stable key order as constructed) + sha256 for publication. */
export function serializeSnapshot(s: EpochSnapshot): { json: string; sha256: `0x${string}` } {
  const json = JSON.stringify(s, null, 2);
  return { json, sha256: sha256(toHex(json)) };
}
