/**
 * Repository-facing types.
 *
 * Split from `repo.ts` so the implementation file stays within the NF5
 * 400-line budget and so routes/tools can import the contract without pulling
 * the implementation (and its `node:fs`-touching dependencies) into scope.
 */
export {};
