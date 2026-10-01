/** 确定性 PRNG（mulberry32）：fixture 生成的可复现性保证。
 *
 * 一切随机性必须走这里（固定种子），禁止 Date.now / Math.random，
 * 保证 `pnpm fixtures:gen` 逐字节可重放（docs/02-design/0206 §2.1）。
 */

export type Prng = () => number

export function mulberry32(seed: number): Prng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** [min, max] 闭区间整数。 */
export function rint(rand: Prng, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
}

export function pick<T>(rand: Prng, arr: readonly T[]): T {
  const i = rint(rand, 0, arr.length - 1)
  const v = arr[i]
  if (v === undefined) throw new Error(`pick out of range: ${i}`)
  return v
}

/** 不重复抽取 n 个（n > length 时取全部）。 */
export function sample<T>(rand: Prng, arr: readonly T[], n: number): T[] {
  const pool = [...arr]
  const out: T[] = []
  while (out.length < n && pool.length > 0) {
    const i = rint(rand, 0, pool.length - 1)
    out.push(pool.splice(i, 1)[0] as T)
  }
  return out
}
