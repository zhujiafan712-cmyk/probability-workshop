import clsx from "clsx";
import type { Mode } from "@/lib/probability";

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
};

export function OutcomeStage({
  mode,
  faces,
  last,
  label,
  running,
  speed,
  pulse,
  reducedMotion,
}: {
  mode: Mode;
  faces: number;
  last: number | null;
  label: string;
  running: boolean;
  speed: number;
  pulse: number;
  reducedMotion: boolean;
}) {
  const whirl = running && speed >= 55 && !reducedMotion;
  const bump = !whirl && pulse > 0 && !reducedMotion;
  const caption = last == null ? "还没有结果" : label;
  const detail =
    last == null
      ? mode === "coin"
        ? "抛一次，或开始一整轮"
        : "掷一次，或开始一整轮"
      : mode === "coin"
        ? "最近一次"
        : `${faces} 面骰子 · 最近一次`;

  return (
    <div className="stage-well flex flex-col items-center justify-center gap-3 rounded-2xl px-4 py-5">
      {mode === "coin" ? (
        <div className="coin-scene" aria-hidden="true">
          <div
            key={bump ? pulse : "coin"}
            className={clsx(
              "coin",
              last === 1 && "is-tails",
              bump && "is-flipping",
              whirl && "is-whirling",
            )}
          >
            <div className="coin-face">正</div>
            <div className="coin-face back">反</div>
          </div>
        </div>
      ) : (
        <div
          key={bump ? pulse : "die"}
          className={clsx("die", bump && "is-bumping", whirl && "is-whirling")}
          aria-hidden="true"
        >
          {faces === 6 && last != null ? (
            <div className="die-pips">
              {Array.from({ length: 9 }, (_, cell) => (
                <span
                  key={cell}
                  className={clsx("pip", (PIPS[last + 1] ?? []).includes(cell) && "on")}
                />
              ))}
            </div>
          ) : (
            <>
              <span className="absolute top-2 left-3 text-xs text-muted">d{faces}</span>
              <span className="font-serif text-5xl tabular-nums">{last == null ? "—" : last + 1}</span>
            </>
          )}
        </div>
      )}
      <p className="text-center">
        <span className="block font-serif text-2xl">{caption}</span>
        <span className="mt-1 block text-sm text-muted">{detail}</span>
      </p>
    </div>
  );
}
