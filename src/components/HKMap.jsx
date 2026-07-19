import { useEffect, useRef, useState } from "react";
import { pointsToString } from "../lib/map";

const ZOOM_MS = 550;

// Animates viewBox changes so selecting a line glides into its route
// instead of jumping. Starts at `initial` when given (fly-in on mount),
// otherwise at the target so mounting doesn't animate.
function useAnimatedViewBox(target, initial = null) {
  const [current, setCurrent] = useState(initial ?? target);
  const currentRef = useRef(initial ?? target);
  const frameRef = useRef(0);
  const key = target.join(",");
  useEffect(() => {
    const from = currentRef.current;
    const to = key.split(",").map(Number);
    if (from.every((value, i) => value === to[i])) return undefined;
    const startedAt = performance.now();
    const tick = (now) => {
      const t = Math.min((now - startedAt) / ZOOM_MS, 1);
      const eased = 1 - (1 - t) ** 3;
      const next = from.map((value, i) => value + (to[i] - value) * eased);
      currentRef.current = next;
      setCurrent(next);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [key]);
  return current;
}

export function HKMap({
  mapModel,
  viewBox,
  selectedLineId = null,
  onSelectLine = null,
  overlayRoute = null,
  activeStationIds = null,
  currentStationId = null,
  completedStationIds = null,
  trainShake = false,
  initialViewBox = null,
  className = "",
}) {
  const [x, y, width, height] = useAnimatedViewBox(viewBox, initialViewBox);
  const selectedRoute =
    overlayRoute ??
    mapModel.routes.find((route) => route.id === selectedLineId) ??
    null;
  const hasSelection = Boolean(selectedRoute);
  // Keep lines, dots and the train the same size on screen at any zoom.
  const unitScale = width / 700;

  return (
    <svg
      className={`hk-map ${className}`}
      viewBox={`${x} ${y} ${width} ${height}`}
      role="img"
      aria-label="Hong Kong MTR map"
    >
      <path
        className="hk-land"
        d={mapModel.boundaryPath}
        strokeWidth={unitScale}
      />
      {mapModel.routes.map((route) => {
        const isSelected = !overlayRoute && route.id === selectedLineId;
        const dimmed = hasSelection && !isSelected;
        return (
          <g
            key={route.id}
            className={`hk-route${dimmed ? " dimmed" : ""}${isSelected ? " selected" : ""}`}
          >
            {route.segments.map((points, index) => (
              <polyline
                key={index}
                points={pointsToString(points)}
                stroke={route.color}
                strokeWidth={(isSelected ? 4 : 2.6) * unitScale}
              />
            ))}
            {onSelectLine
              ? route.segments.map((points, index) => (
                  <polyline
                    key={`hit-${index}`}
                    className="hk-route-hit"
                    points={pointsToString(points)}
                    onClick={() => onSelectLine(route.id)}
                  />
                ))
              : null}
          </g>
        );
      })}
      {overlayRoute ? (
        <g className="hk-route selected">
          {overlayRoute.segments.map((points, index) => (
            <polyline
              key={index}
              points={pointsToString(points)}
              stroke={overlayRoute.color}
              strokeWidth={4 * unitScale}
            />
          ))}
        </g>
      ) : null}
      {selectedRoute && activeStationIds
        ? activeStationIds.map((stationId) => {
            const point = selectedRoute.pointsById.get(stationId);
            if (!point) return null;
            const isCurrent = stationId === currentStationId;
            const isDone = completedStationIds?.has(stationId);
            return (
              <circle
                key={stationId}
                className={`hk-station${isCurrent ? " current" : ""}${isDone ? " done" : ""}`}
                cx={point[0]}
                cy={point[1]}
                r={(isCurrent ? 6 : 4) * unitScale}
                strokeWidth={(isCurrent ? 3 : 2) * unitScale}
                style={{ "--line-color": selectedRoute.color }}
              />
            );
          })
        : null}
      {selectedRoute && currentStationId
        ? (() => {
            const point = selectedRoute.pointsById.get(currentStationId);
            if (!point) return null;
            const index = activeStationIds?.indexOf(currentStationId) ?? -1;
            const previous =
              index > 0
                ? selectedRoute.pointsById.get(activeStationIds[index - 1])
                : null;
            const next =
              index >= 0 && index < (activeStationIds?.length ?? 0) - 1
                ? selectedRoute.pointsById.get(activeStationIds[index + 1])
                : null;
            // Face the direction of travel: away from the previous stop, or
            // toward the next one when waiting at the first station.
            const reference = previous ?? point;
            const target = previous ? point : (next ?? point);
            const angle =
              (Math.atan2(target[1] - reference[1], target[0] - reference[0]) *
                180) /
              Math.PI;
            return (
              <TrainMarker
                x={point[0]}
                y={point[1]}
                angle={angle}
                scale={width / 700}
                color={selectedRoute.color}
                shake={trainShake}
              />
            );
          })()
        : null}
    </svg>
  );
}

// A shaded top-down MTR train drawn pointing right and centred on the
// origin; gradients and a soft shadow give it a pseudo-3D look.
function TrainMarker({ x, y, angle, scale, color, shake }) {
  return (
    <g
      className="hk-train"
      style={{
        transform: `translate(${x}px, ${y}px) rotate(${angle}deg) scale(${scale})`,
      }}
    >
      {/* Shake lives on an inner group so it stacks with the position
          transform instead of fighting it. */}
      <g className={`hk-train-body${shake ? " shake" : ""}`}>
      <defs>
        <linearGradient id="train-body" x1="0" y1="-7" x2="0" y2="7" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fdfdfd" />
          <stop offset="0.45" stopColor="#cfd4da" />
          <stop offset="1" stopColor="#8f969f" />
        </linearGradient>
        <linearGradient id="train-glass" x1="0" y1="-5" x2="0" y2="5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4a545e" />
          <stop offset="1" stopColor="#20262c" />
        </linearGradient>
        <clipPath id="train-clip">
          <rect x="-16" y="-7" width="32" height="14" rx="6.5" />
        </clipPath>
      </defs>
      <ellipse cx="0" cy="6" rx="16" ry="4" fill="rgba(10, 14, 20, 0.28)" />
      <rect
        x="-16"
        y="-7"
        width="32"
        height="14"
        rx="6.5"
        fill="url(#train-body)"
        stroke="rgba(20, 25, 32, 0.35)"
        strokeWidth="0.6"
      />
      <g clipPath="url(#train-clip)">
        <rect x="-16" y="2" width="32" height="3.4" fill={color} opacity="0.95" />
        <rect x="12.6" y="-7" width="3.4" height="14" fill="#c8102e" />
      </g>
      <path
        d="M 7 -5.2 Q 12.6 -4.4 13.4 0 Q 12.6 4.4 7 5.2 Z"
        fill="url(#train-glass)"
      />
      <rect
        x="-14.5"
        y="-5.4"
        width="20"
        height="1.6"
        rx="0.8"
        fill="rgba(255, 255, 255, 0.75)"
      />
      <circle cx="14.6" cy="-3" r="0.9" fill="#ffe9a8" />
      <circle cx="14.6" cy="3" r="0.9" fill="#ffe9a8" />
      </g>
    </g>
  );
}
