/** JSON-safe conversion: bigint → string, Date → ISO. */
export function toJson<T>(v: T): unknown {
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)));
}
