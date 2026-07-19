import { useEffect, useMemo, useState } from "react";
import { Rewind, X } from "lucide-react";
import { HKMap } from "./HKMap";
import { getRouteViewBox } from "../lib/map";
import { routeTextColor } from "../lib/busNormalize";

// Longer routes get a longer replay, clamped so a 60-stop route doesn't
// drag on forever and a 3-stop hop still reads as a journey.
const MS_PER_STOP = 220;
const MIN_DURATION_MS = 2400;
const MAX_DURATION_MS = 9000;

// Drives busLength from 0 to the run's full length once per `playToken`,
// so the parent can restart the animation just by bumping the token.
function useReplayProgress(activeRun, playToken) {
  const totalLength = activeRun?.stops[activeRun.stops.length - 1]?.length ?? 0;
  const duration = Math.min(
    MAX_DURATION_MS,
    Math.max(MIN_DURATION_MS, (activeRun?.stops.length ?? 0) * MS_PER_STOP),
  );
  const [busLength, setBusLength] = useState(0);

  useEffect(() => {
    if (!activeRun) return undefined;
    setBusLength(0);
    const startedAt = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      setBusLength(totalLength * progress);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activeRun, totalLength, duration, playToken]);

  return busLength;
}

export function JourneyReplay({ t, mapModel, route, activeRun, runLabel, onClose }) {
  const [playToken, setPlayToken] = useState(0);
  const busLength = useReplayProgress(activeRun, playToken);
  const viewBox = useMemo(() => getRouteViewBox(route, 320, 64, 0.16), [route]);

  const currentStopIndex = useMemo(() => {
    if (!activeRun) return 0;
    let index = 0;
    activeRun.stops.forEach((stop, i) => {
      if (stop.length <= busLength) index = i;
    });
    return index;
  }, [activeRun, busLength]);

  return (
    <div
      className="journey-replay-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("rewindJourney")}
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="journey-replay-card"
        style={{ "--line-color": route.color }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="journey-replay-head">
          <span
            className="line-chip"
            style={{ background: route.color, color: routeTextColor(route.co) }}
          >
            {route.code}
          </span>
          <strong>{runLabel}</strong>
          <button
            type="button"
            className="icon-button journey-replay-close"
            aria-label={t("close")}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="journey-replay-map">
          <HKMap
            mapModel={mapModel}
            viewBox={viewBox}
            selectedLineId={route.id}
            activeRun={activeRun}
            currentStopIndex={currentStopIndex}
            completedCount={currentStopIndex}
            busLength={busLength}
          />
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => setPlayToken((value) => value + 1)}
        >
          <Rewind size={16} aria-hidden="true" />
          {t("replayAgain")}
        </button>
      </div>
    </div>
  );
}
