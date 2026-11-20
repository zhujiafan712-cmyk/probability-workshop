import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import * as Slider from "@radix-ui/react-slider";
import { BarChart3, Dices, Pause, Play, RotateCcw } from "lucide-react";
import clsx from "clsx";
import { DistributionChart } from "@/components/distribution-chart";
import { OutcomeStage } from "@/components/outcome-stage";
import {
  DIE_FACES,
  MAX_TRIALS,
  lesson,
  maxAbsDev,
  modelLabels,
  modelProbs,
  sampleIndex,
  sampleMean,
  speedCaption,
  theoreticalDieMean,
  tickPlan,
  totalCount,
  type ChartView,
  type Mode,
} from "@/lib/probability";

type State = {
  mode: Mode;
  faces: number;
  headsPercent: number;
  target: number;
  speed: number;
  counts: number[];
  done: number;
  last: number | null;
  running: boolean;
  view: ChartView;
  notice: string | null;
  pulse: number;
};

type Action =
  | { type: "set-mode"; mode: Mode }
  | { type: "set-faces"; faces: number }
  | { type: "set-heads"; headsPercent: number }
  | { type: "set-target"; target: number }
  | { type: "set-speed"; speed: number }
  | { type: "set-view"; view: ChartView }
  | { type: "tick"; counts: number[]; done: number; last: number; animated: boolean }
  | { type: "start" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "once"; index: number };

const PRESETS = [20, 100, 500, 2000];

function emptyCounts(mode: Mode, faces: number): number[] {
  return Array.from({ length: mode === "coin" ? 2 : faces }, () => 0);
}

function clampTarget(n: number): number {
  return Math.min(MAX_TRIALS, Math.max(1, Math.round(n)));
}

const initialState: State = {
  mode: "coin",
  faces: 6,
  headsPercent: 50,
  target: 100,
  speed: 28,
  counts: [0, 0],
  done: 0,
  last: null,
  running: false,
  view: "freq",
  notice: null,
  pulse: 0,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set-mode": {
      if (state.running || state.mode === action.mode) return state;
      const next = { ...state, mode: action.mode };
      return {
        ...next,
        counts: emptyCounts(next.mode, next.faces),
        done: 0,
        last: null,
        notice: "换了试验模型，之前的记录已清空。",
      };
    }
    case "set-faces": {
      if (state.running || state.faces === action.faces) return state;
      return {
        ...state,
        faces: action.faces,
        counts: emptyCounts("die", action.faces),
        done: 0,
        last: null,
        notice: "骰子面数变了，之前的记录已清空。",
      };
    }
    case "set-heads": {
      if (state.running || state.headsPercent === action.headsPercent) return state;
      return {
        ...state,
        headsPercent: action.headsPercent,
        counts: emptyCounts("coin", state.faces),
        done: 0,
        last: null,
        notice: "正面概率变了，之前的记录已清空。",
      };
    }
    case "set-target":
      if (state.running) return state;
      return { ...state, target: clampTarget(action.target) };
    case "set-speed":
      return { ...state, speed: Math.min(100, Math.max(0, action.speed)) };
    case "set-view":
      return { ...state, view: action.view };
    case "tick":
      return {
        ...state,
        counts: action.counts,
        done: action.done,
        last: action.last,
        pulse: action.animated ? state.pulse + 1 : state.pulse,
      };
    case "start": {
      const fresh = state.done >= state.target;
      return {
        ...state,
        counts: fresh ? emptyCounts(state.mode, state.faces) : state.counts,
        done: fresh ? 0 : state.done,
        last: fresh ? null : state.last,
        running: true,
        notice: null,
      };
    }
    case "pause":
      return { ...state, running: false };
    case "reset":
      return {
        ...state,
        counts: emptyCounts(state.mode, state.faces),
        done: 0,
        last: null,
        running: false,
        notice: null,
      };
    case "once": {
      if (state.running) return state;
      const counts = state.counts.slice();
      counts[action.index] = (counts[action.index] ?? 0) + 1;
      const done = state.done + 1;
      return {
        ...state,
        counts,
        done,
        last: action.index,
        target: Math.max(state.target, done),
        notice: null,
        pulse: state.pulse + 1,
      };
    }
    default:
      return state;
  }
}

function SliderRow({
  label,
  hint,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
  valueText,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  valueText: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm font-medium tabular-nums text-accent">{valueText}</span>
      </div>
      <Slider.Root
        className="relative flex h-11 w-full touch-none items-center"
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={([next]) => {
          if (next != null) onChange(next);
        }}
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-line">
          <Slider.Range className="absolute h-full rounded-full bg-accent" />
        </Slider.Track>
        <Slider.Thumb
          aria-label={label}
          className="grid size-11 place-items-center rounded-full bg-transparent disabled:opacity-40"
        >
          <span className="size-5 rounded-full border-2 border-accent bg-surface shadow-sm" />
        </Slider.Thumb>
      </Slider.Root>
      <p className="text-sm text-muted">{hint}</p>
    </div>
  );
}

export function ProbabilityLab() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [targetText, setTargetText] = useState(String(initialState.target));
  const [reducedMotion, setReducedMotion] = useState(false);
  const stateRef = useRef(state);
  const probsRef = useRef<number[]>([0.5, 0.5]);
  stateRef.current = state;

  const probs = useMemo(
    () => modelProbs(state.mode, state.faces, state.headsPercent),
    [state.mode, state.faces, state.headsPercent],
  );
  const labels = useMemo(
    () => modelLabels(state.mode, state.faces),
    [state.mode, state.faces],
  );
  probsRef.current = probs;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setTargetText(String(state.target));
  }, [state.target]);

  useEffect(() => {
    if (!state.running) return;
    let raf = 0;
    let cancelled = false;
    let lastTime = 0;
    let counts = stateRef.current.counts.slice();
    let done = stateRef.current.done;

    const loop = (now: number) => {
      if (cancelled || !stateRef.current.running) return;
      const target = stateRef.current.target;
      const remaining = target - done;
      if (remaining <= 0) {
        dispatch({ type: "pause" });
        return;
      }
      const plan = tickPlan(stateRef.current.speed, remaining);
      if (lastTime !== 0 && now - lastTime < plan.intervalMs) {
        raf = requestAnimationFrame(loop);
        return;
      }
      lastTime = now;
      const batch = Math.min(plan.batch, remaining);
      const currentProbs = probsRef.current;
      let last = 0;
      for (let i = 0; i < batch; i++) {
        last = sampleIndex(currentProbs);
        counts[last] = (counts[last] ?? 0) + 1;
      }
      done += batch;
      dispatch({
        type: "tick",
        counts: counts.slice(),
        done,
        last,
        animated: batch === 1,
      });
      if (done >= target) {
        dispatch({ type: "pause" });
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [state.running]);

  const n = totalCount(state.counts);
  const dev = maxAbsDev(state.counts, probs);
  const note = lesson({
    n,
    dev,
    mode: state.mode,
    headsPercent: state.headsPercent,
    faces: state.faces,
  });
  const mean = state.mode === "die" ? sampleMean(state.counts) : null;
  const headsRate = n === 0 ? null : (state.counts[0] ?? 0) / n;
  const finished = state.done >= state.target && state.done > 0;
  const primaryLabel = state.running ? "暂停" : finished ? "再来一轮" : state.done > 0 ? "继续" : "开始试验";
  const progress = state.target === 0 ? 0 : Math.min(100, (state.done / state.target) * 100);
  const lastLabel = state.last == null ? "" : (labels[state.last] ?? "");

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">
      <header className="flex items-start gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ink text-paper">
          <BarChart3 className="size-6" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-medium text-accent">基础概率实验</p>
          <h1 className="mt-1 text-3xl md:text-4xl">概率工坊</h1>
          <p className="mt-2 max-w-2xl text-muted">
            抛硬币或掷骰子，看着直方图在试验过程中更新。青绿色是你得到的结果，陶土色是理论值。
          </p>
        </div>
      </header>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-5">
        <section className="space-y-5 rounded-2xl border border-line bg-surface p-4 md:p-5 lg:col-span-2">
          <div>
            <h2 className="text-xl">试验</h2>
            <p className="mt-1 text-sm text-muted">每次结果互相独立，之前发生什么不影响下一次。</p>
          </div>

          <OutcomeStage
            mode={state.mode}
            faces={state.faces}
            last={state.last}
            label={lastLabel}
            running={state.running}
            speed={state.speed}
            pulse={state.pulse}
            reducedMotion={reducedMotion}
          />

          <div role="radiogroup" aria-label="试验类型" className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "coin" as const, label: "抛硬币" },
                { id: "die" as const, label: "掷骰子" },
              ]
            ).map((item) => {
              const active = state.mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={state.running}
                  className={clsx(
                    "h-12 rounded-xl text-sm font-medium disabled:opacity-40",
                    active ? "bg-ink text-paper" : "border border-line bg-surface text-ink",
                  )}
                  onClick={() => dispatch({ type: "set-mode", mode: item.id })}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div
            className="h-1.5 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={state.target}
            aria-valuenow={Math.min(state.done, state.target)}
            aria-label="试验进度"
          >
            <div className="h-full bg-accent motion-safe:transition-[width] motion-safe:duration-150" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-muted tabular-nums" aria-live={state.running ? "off" : "polite"}>
            {state.running ? "试验进行中" : finished ? "本轮已完成" : state.done > 0 ? "已暂停" : "尚未开始"}
            <span className="text-ink"> · {state.done}</span> / {state.target}
          </p>

          {state.notice ? (
            <p className="rounded-xl bg-well px-3 py-2 text-sm" role="status">
              {state.notice}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-accent-ink"
              onClick={() => dispatch({ type: state.running ? "pause" : "start" })}
            >
              {state.running ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
              {primaryLabel}
            </button>
            <button
              type="button"
              disabled={state.running}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-medium disabled:opacity-40"
              onClick={() => dispatch({ type: "once", index: sampleIndex(probs) })}
            >
              <Dices className="size-4" aria-hidden="true" />
              {state.mode === "coin" ? "抛一次" : "掷一次"}
            </button>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-medium"
              onClick={() => dispatch({ type: "reset" })}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              重置
            </button>
          </div>

          {state.mode === "coin" ? (
            <SliderRow
              label="正面概率"
              hint={
                state.headsPercent === 50
                  ? "公平硬币：正反各 50%。左右拖动，就能做成一枚有偏的硬币。"
                  : `这是一枚有偏硬币。反面概率是 ${100 - state.headsPercent}%。`
              }
              min={0}
              max={100}
              step={5}
              value={state.headsPercent}
              disabled={state.running}
              valueText={`${state.headsPercent}%`}
              onChange={(headsPercent) => dispatch({ type: "set-heads", headsPercent })}
            />
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">骰子面数</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="骰子面数">
                {DIE_FACES.map((faces) => {
                  const active = state.faces === faces;
                  return (
                    <button
                      key={faces}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={state.running}
                      className={clsx(
                        "h-11 rounded-xl text-sm font-medium tabular-nums disabled:opacity-40",
                        active ? "bg-accent text-accent-ink" : "border border-line bg-surface text-ink",
                      )}
                      onClick={() => dispatch({ type: "set-faces", faces })}
                    >
                      {faces} 面
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-muted">公平骰子，每一面概率 1/{state.faces}。</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="trial-count" className="text-sm font-medium">
                试验次数
              </label>
              <input
                id="trial-count"
                inputMode="numeric"
                disabled={state.running}
                value={targetText}
                aria-label="试验次数"
                className="h-11 w-24 rounded-xl border border-line bg-paper px-3 text-right text-sm font-medium tabular-nums disabled:opacity-40"
                onChange={(event) => {
                  const next = event.target.value.replace(/[^\d]/g, "").slice(0, 4);
                  setTargetText(next);
                  const parsed = Number(next);
                  if (next !== "" && parsed >= 1 && parsed <= MAX_TRIALS) {
                    dispatch({ type: "set-target", target: parsed });
                  }
                }}
                onBlur={() => {
                  const parsed = Number(targetText);
                  const next = clampTarget(targetText === "" || parsed < 1 ? 1 : parsed);
                  setTargetText(String(next));
                  dispatch({ type: "set-target", target: next });
                }}
              />
            </div>
            <Slider.Root
              className="relative flex h-11 w-full touch-none items-center"
              min={1}
              max={MAX_TRIALS}
              step={1}
              value={[Math.min(state.target, MAX_TRIALS)]}
              disabled={state.running}
              onValueChange={([next]) => {
                if (next != null) dispatch({ type: "set-target", target: next });
              }}
            >
              <Slider.Track className="relative h-1.5 grow rounded-full bg-line">
                <Slider.Range className="absolute h-full rounded-full bg-accent" />
              </Slider.Track>
              <Slider.Thumb aria-label="试验次数滑块" className="grid size-11 place-items-center rounded-full bg-transparent">
                <span className="size-5 rounded-full border-2 border-accent bg-surface shadow-sm" />
              </Slider.Thumb>
            </Slider.Root>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={state.running}
                  className={clsx(
                    "h-11 rounded-xl text-sm tabular-nums disabled:opacity-40",
                    state.target === preset
                      ? "bg-ink text-paper"
                      : "border border-line bg-surface text-ink",
                  )}
                  onClick={() => dispatch({ type: "set-target", target: preset })}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <SliderRow
            label="动画速度"
            hint={speedCaption(state.speed)}
            min={0}
            max={100}
            step={1}
            value={state.speed}
            valueText={state.speed < 25 ? "慢" : state.speed < 55 ? "中" : state.speed < 80 ? "快" : "极快"}
            onChange={(speed) => dispatch({ type: "set-speed", speed })}
          />
        </section>

        <section className="min-w-0 space-y-4 lg:col-span-3">
          <div className="rounded-2xl border border-line bg-surface p-4 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl">结果直方图</h2>
                <p className="mt-1 max-w-xl text-sm text-muted">
                  {state.view === "freq"
                    ? "纵轴从 0% 画到 100%。两根柱子越接近，这轮结果越像理论模型。"
                    : "期望次数 = 试验次数 × 理论概率。它会随次数一起变高。"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="直方图刻度">
                {(
                  [
                    { id: "freq" as const, label: "频率" },
                    { id: "count" as const, label: "次数" },
                  ]
                ).map((item) => {
                  const active = state.view === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={clsx(
                        "h-11 rounded-xl px-4 text-sm font-medium",
                        active ? "bg-ink text-paper" : "border border-line bg-surface",
                      )}
                      onClick={() => dispatch({ type: "set-view", view: item.id })}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <DistributionChart labels={labels} counts={state.counts} probs={probs} view={state.view} />
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-well px-2 py-3 text-center">
                <dt className="text-xs text-muted">已记录</dt>
                <dd className="mt-1 text-lg font-medium tabular-nums">{n}</dd>
              </div>
              <div className="rounded-xl bg-well px-2 py-3 text-center">
                <dt className="text-xs text-muted">最大偏差</dt>
                <dd className="mt-1 text-lg font-medium tabular-nums">{n === 0 ? "—" : (dev * 100).toFixed(1)}</dd>
                <p className="text-xs text-muted">百分点</p>
              </div>
              <div className="rounded-xl bg-well px-2 py-3 text-center">
                {state.mode === "coin" ? (
                  <>
                    <dt className="text-xs text-muted">正面频率</dt>
                    <dd className="mt-1 text-lg font-medium tabular-nums">
                      {headsRate == null ? "—" : `${(headsRate * 100).toFixed(1)}%`}
                    </dd>
                    <p className="text-xs text-muted tabular-nums">理论 {state.headsPercent}%</p>
                  </>
                ) : (
                  <>
                    <dt className="text-xs text-muted">平均点数</dt>
                    <dd className="mt-1 text-lg font-medium tabular-nums">
                      {mean == null ? "—" : mean.toFixed(2)}
                    </dd>
                    <p className="text-xs text-muted tabular-nums">理论 {theoreticalDieMean(state.faces).toFixed(2)}</p>
                  </>
                )}
              </div>
            </dl>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm tabular-nums">
                <caption className="sr-only">实际结果与理论概率对照</caption>
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">结果</th>
                    <th scope="col" className="py-2 pr-3 font-medium">次数</th>
                    <th scope="col" className="py-2 pr-3 font-medium">频率</th>
                    <th scope="col" className="py-2 pr-3 font-medium">理论</th>
                    <th scope="col" className="py-2 font-medium">偏差</th>
                  </tr>
                </thead>
                <tbody>
                  {labels.map((label, index) => {
                    const count = state.counts[index] ?? 0;
                    const p = probs[index] ?? 0;
                    const freq = n === 0 ? 0 : count / n;
                    const delta = freq - p;
                    const sign = delta > 0 ? "+" : "";
                    return (
                      <tr key={label} className="border-b border-line last:border-0">
                        <th scope="row" className="py-2 pr-3 font-medium">{label}</th>
                        <td className="py-2 pr-3">{count}</td>
                        <td className="py-2 pr-3">{n === 0 ? "—" : `${(freq * 100).toFixed(1)}%`}</td>
                        <td className="py-2 pr-3">{(p * 100).toFixed(1)}%</td>
                        <td className="py-2">{n === 0 ? "—" : `${sign}${(delta * 100).toFixed(1)}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-2xl border border-line border-l-4 border-l-accent bg-surface p-4 md:p-5">
            <p className="text-sm font-medium text-accent">课堂笔记</p>
            <h2 className="mt-1 text-xl">{note.title}</h2>
            <p className="mt-2 text-muted">{note.body}</p>
          </aside>
        </section>
      </div>
    </main>
  );
}
