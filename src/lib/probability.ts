export type Mode = "coin" | "die";
export type ChartView = "freq" | "count";

export const DIE_FACES = [4, 6, 8, 10, 12, 20] as const;
export const MAX_TRIALS = 5000;

export function modelProbs(mode: Mode, faces: number, headsPercent: number): number[] {
  if (mode === "coin") {
    const p = headsPercent / 100;
    return [p, 1 - p];
  }
  const p = 1 / faces;
  return Array.from({ length: faces }, () => p);
}

export function modelLabels(mode: Mode, faces: number): string[] {
  if (mode === "coin") return ["正面", "反面"];
  return Array.from({ length: faces }, (_, i) => String(i + 1));
}

export function sampleIndex(probs: number[]): number {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i] ?? 0;
    if (r < acc) return i;
  }
  return Math.max(0, probs.length - 1);
}

export function totalCount(counts: number[]): number {
  return counts.reduce((sum, n) => sum + n, 0);
}

export function maxAbsDev(counts: number[], probs: number[]): number {
  const n = totalCount(counts);
  if (n === 0) return 0;
  let max = 0;
  for (let i = 0; i < counts.length; i++) {
    max = Math.max(max, Math.abs((counts[i] ?? 0) / n - (probs[i] ?? 0)));
  }
  return max;
}

export function sampleMean(counts: number[]): number | null {
  const n = totalCount(counts);
  if (n === 0) return null;
  let sum = 0;
  for (let i = 0; i < counts.length; i++) {
    sum += (i + 1) * (counts[i] ?? 0);
  }
  return sum / n;
}

export function theoreticalDieMean(faces: number): number {
  return (faces + 1) / 2;
}

export function tickPlan(speed: number, remaining: number): { batch: number; intervalMs: number } {
  const room = Math.max(0, remaining);
  if (room === 0) return { batch: 0, intervalMs: 1000 };
  const s = Math.min(100, Math.max(0, speed));
  if (s < 25) return { batch: 1, intervalMs: Math.round(560 - s * 14) };
  if (s < 55) {
    const t = (s - 25) / 30;
    return { batch: 1, intervalMs: Math.round(210 - t * 140) };
  }
  if (s < 80) {
    const t = (s - 55) / 25;
    return { batch: 2 + Math.round(t * 10), intervalMs: 48 };
  }
  const t = (s - 80) / 20;
  return { batch: Math.min(room, Math.round(16 + t * 420)), intervalMs: 32 };
}

export function speedCaption(speed: number): string {
  if (speed < 25) return "逐次观看：每次只产生一个结果";
  if (speed < 55) return "仍能跟上每一次结果";
  if (speed < 80) return "一小批一小批计入直方图";
  return "快速灌入，柱子仍会分步长高";
}

export function lesson(input: {
  n: number;
  dev: number;
  mode: Mode;
  headsPercent: number;
  faces: number;
}): { title: string; body: string } {
  const { n, dev, mode, headsPercent, faces } = input;
  if (n === 0) {
    return {
      title: "理论值先画在图上",
      body:
        mode === "coin"
          ? "理论柱来自你设定的概率，和运气无关。试验开始后，实际频率会在它旁边摆动；次数变多，通常会靠得更近。"
          : `公平的 ${faces} 面骰子，每一面理论概率都是 1/${faces}。先记住理论柱的高度，再看试验怎么靠近它。`,
    };
  }
  if (mode === "coin" && (headsPercent === 0 || headsPercent === 100)) {
    const certain = headsPercent === 100 ? "正面" : "反面";
    return {
      title: "0 和 1 没有随机性",
      body: `模型规定每次都是${certain}，所以频率会马上贴住理论柱。把正面概率调回中间，才能看到摆动。`,
    };
  }
  const pp = (dev * 100).toFixed(1);
  if (n < 30) {
    return {
      title: "次数太少，频率还不可信",
      body: `目前 ${n} 次，最大偏差 ${pp} 个百分点。短序列里连续同一面很常见，不能据此判断硬币或骰子不公平。`,
    };
  }
  if (dev > 0.06) {
    return {
      title: "正在靠近，但路径不平滑",
      body: `最大偏差还有 ${pp} 个百分点。大数定律说的是次数足够多时频率会靠近理论概率，不是每多一次就一定更近。把速度调快，继续看。`,
    };
  }
  return {
    title: "频率正在贴住概率",
    body: `做了 ${n} 次，最大偏差 ${pp} 个百分点。单次的运气被平均掉了。偏差缩小的速度大约跟次数的平方根有关：从 100 次到 1000 次，通常比从 10 次到 20 次更能说明问题。`,
  };
}
