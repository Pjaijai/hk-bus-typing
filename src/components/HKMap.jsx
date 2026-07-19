import { useEffect, useRef, useState } from "react";
import { pointsToString } from "../lib/map";
import { pointAtLength } from "../lib/busGeometry";

const ZOOM_MS = 550;

// Beyond this viewBox width only the termini get dots — a 60-stop route
// zoomed out is a string of beads otherwise.
const ALL_STOPS_WIDTH = 500;

// Animates viewBox changes so selecting a route glides into it instead of
// jumping. Starts at `initial` when given (fly-in on mount), otherwise at
// the target so mounting doesn't animate.
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
  activeRun = null,
  currentStopIndex = null,
  completedCount = 0,
  busLength = null,
  busShake = false,
  busSpeeding = 0,
  busBoost = false,
  initialViewBox = null,
  className = "",
}) {
  const [x, y, width, height] = useAnimatedViewBox(viewBox, initialViewBox);
  const selectedRoute =
    mapModel.routes.find((route) => route.id === selectedLineId) ?? null;
  const hasSelection = Boolean(selectedRoute);
  // Keep lines, dots and the bus the same size on screen at any zoom.
  const unitScale = width / 700;
  const showAllStops = width < ALL_STOPS_WIDTH;

  const stops = activeRun?.stops ?? [];
  const visibleStops = showAllStops
    ? stops.map((stop, index) => ({ stop, index }))
    : [0, stops.length - 1]
        .filter((index, i, arr) => index >= 0 && arr.indexOf(index) === i)
        .map((index) => ({ stop: stops[index], index }));

  // The bus sits at an arc length along the run's geometry — callers move
  // it continuously (typing progress) or park it at a stop's length.
  const busAt = busLength ?? stops[currentStopIndex ?? -1]?.length ?? null;
  const bus =
    activeRun && busAt != null
      ? pointAtLength(activeRun.geometry, activeRun.lengths, busAt)
      : null;

  return (
    <svg
      className={`hk-map ${className}${hasSelection ? "" : " overview"}`}
      viewBox={`${x} ${y} ${width} ${height}`}
      role="img"
      aria-label="Hong Kong bus route map"
    >
      <path
        className="hk-land"
        d={mapModel.boundaryPath}
        strokeWidth={unitScale}
      />
      {mapModel.routes.map((route) => {
        const isSelected = route.id === selectedLineId;
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
                strokeWidth={(isSelected ? 4 : hasSelection ? 1.6 : 2.4) * unitScale}
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
      {selectedRoute
        ? visibleStops.map(({ stop, index }) => {
            if (!stop) return null;
            const isCurrent = index === currentStopIndex;
            const isDone = index < completedCount;
            return (
              <circle
                key={index}
                className={`hk-station${isCurrent ? " current" : ""}${isDone ? " done" : ""}`}
                cx={stop.point[0]}
                cy={stop.point[1]}
                r={(isCurrent ? 6 : 3) * unitScale}
                strokeWidth={(isCurrent ? 3 : 1.8) * unitScale}
                style={{ "--line-color": selectedRoute.color }}
              />
            );
          })
        : null}
      {selectedRoute && bus ? (
        <VehicleMarker
          x={bus.point[0]}
          y={bus.point[1]}
          angle={(bus.angle * 180) / Math.PI}
          scale={(width / 700) * 3}
          color={selectedRoute.color}
          kind={vehicleKind(selectedRoute.operator)}
          shake={busShake}
          speeding={busSpeeding}
          boost={busBoost}
        />
      ) : null}
    </svg>
  );
}

// Which top-down vehicle the marker draws. Green minibuses and the three
// ferry operators get their own silhouette; everything else (franchised
// buses, MTR/light rail, feeder buses) rides the double-decker.
const FERRY_OPERATORS = new Set(["sunferry", "fortuneferry", "hkkf"]);
export function vehicleKind(operator) {
  if (operator === "gmb") return "minibus";
  if (FERRY_OPERATORS.has(operator)) return "ferry";
  return "bus";
}

// A shaded top-down vehicle drawn pointing right and centred on the origin;
// the bodywork takes the route colour. The wrapper — position, boost ring,
// shake, and speed streaks — is shared; only the silhouette changes by kind.
function VehicleMarker({ x, y, angle, scale, color, kind, shake, speeding, boost }) {
  const Body =
    kind === "ferry" ? FerryBody : kind === "minibus" ? MinibusBody : BusBody;
  return (
    <g
      className="hk-train"
      style={{
        transform: `translate(${x}px, ${y}px) rotate(${angle}deg) scale(${scale})`,
      }}
    >
      {/* A one-shot ring burst on every 10th streak — sits outside the
          body group so its own radius animation doesn't fight the
          shake/scale transforms. */}
      {boost ? (
        <circle className="hk-train-boost-ring" cx="0" cy="0" r="8" />
      ) : null}
      {/* Shake lives on an inner group so it stacks with the position
          transform instead of fighting it. */}
      <g className={`hk-train-body${shake ? " shake" : ""}${boost ? " boost" : ""}`}>
        {speeding ? (
          <g
            className={`bus-streaks${speeding >= 2 ? " max" : ""}`}
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="1.1"
          >
            <line x1="-13.5" y1="-3.2" x2="-22" y2="-3.2" />
            <line x1="-14.5" y1="0" x2="-26" y2="0" />
            <line x1="-13.5" y1="3.2" x2="-22" y2="3.2" />
            {speeding >= 2 ? (
              <>
                <line x1="-16" y1="-5.2" x2="-30" y2="-5.2" />
                <line x1="-17" y1="1.6" x2="-32" y2="1.6" />
                <line x1="-16" y1="5.2" x2="-30" y2="5.2" />
              </>
            ) : null}
          </g>
        ) : null}
        <defs>
          <linearGradient
            id="bus-body"
            x1="0"
            y1="-5"
            x2="0"
            y2="5"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#fdfdfd" />
            <stop offset="0.5" stopColor="#d9dde2" />
            <stop offset="1" stopColor="#99a0a8" />
          </linearGradient>
          <linearGradient
            id="bus-glass"
            x1="0"
            y1="-4"
            x2="0"
            y2="4"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#4a545e" />
            <stop offset="1" stopColor="#20262c" />
          </linearGradient>
        </defs>
        <Body color={color} />
      </g>
    </g>
  );
}

// Double-decker: full-length roof wrap in the route colour, front windscreen.
function BusBody({ color }) {
  return (
    <>
      <defs>
        <clipPath id="bus-clip">
          <rect x="-11" y="-4.5" width="22" height="9" rx="2.6" />
        </clipPath>
      </defs>
      <ellipse cx="0" cy="4" rx="11" ry="2.6" fill="rgba(10, 14, 20, 0.28)" />
      <rect
        x="-11"
        y="-4.5"
        width="22"
        height="9"
        rx="2.6"
        fill="url(#bus-body)"
        stroke="rgba(20, 25, 32, 0.35)"
        strokeWidth="0.5"
      />
      <g clipPath="url(#bus-clip)">
        {/* Route-coloured roof with a pale centre ridge and hatches. */}
        <rect x="-10.2" y="-3.6" width="18.6" height="7.2" rx="2" fill={color} opacity="0.92" />
        <rect x="-9.6" y="-0.55" width="17.4" height="1.1" rx="0.55" fill="rgba(255,255,255,0.5)" />
        <rect x="-7.5" y="-2.6" width="3.2" height="5.2" rx="0.7" fill="rgba(255,255,255,0.28)" />
        <rect x="-1.5" y="-2.6" width="3.2" height="5.2" rx="0.7" fill="rgba(255,255,255,0.28)" />
        <rect x="4.5" y="-2.6" width="3.2" height="5.2" rx="0.7" fill="rgba(255,255,255,0.28)" />
      </g>
      {/* Front windscreen band ahead of the roof wrap. */}
      <path
        d="M 8.6 -3.6 Q 10.6 -2.8 10.9 0 Q 10.6 2.8 8.6 3.6 Z"
        fill="url(#bus-glass)"
      />
      <circle cx="10.4" cy="-2" r="0.7" fill="#ffe9a8" />
      <circle cx="10.4" cy="2" r="0.7" fill="#ffe9a8" />
    </>
  );
}

// Green minibus: shorter and narrower than the double-decker, with the
// route-coloured roof band Hong Kong minibuses actually wear.
function MinibusBody({ color }) {
  return (
    <>
      <defs>
        <clipPath id="minibus-clip">
          <rect x="-8" y="-3.9" width="16" height="7.8" rx="2.4" />
        </clipPath>
      </defs>
      <ellipse cx="0" cy="3.4" rx="8" ry="2.1" fill="rgba(10, 14, 20, 0.28)" />
      <rect
        x="-8"
        y="-3.9"
        width="16"
        height="7.8"
        rx="2.4"
        fill="url(#bus-body)"
        stroke="rgba(20, 25, 32, 0.35)"
        strokeWidth="0.5"
      />
      <g clipPath="url(#minibus-clip)">
        {/* Rear route-coloured roof band; the front third stays white cab. */}
        <rect x="-7.4" y="-3.1" width="11" height="6.2" rx="1.6" fill={color} opacity="0.92" />
        <rect x="-6.8" y="-0.5" width="10" height="1" rx="0.5" fill="rgba(255,255,255,0.5)" />
        <rect x="-5.4" y="-2.2" width="2.6" height="4.4" rx="0.6" fill="rgba(255,255,255,0.3)" />
        <rect x="-0.6" y="-2.2" width="2.6" height="4.4" rx="0.6" fill="rgba(255,255,255,0.3)" />
      </g>
      {/* Rounded windscreen and headlights at the front. */}
      <path
        d="M 5.4 -3.1 Q 7.6 -2.4 7.9 0 Q 7.6 2.4 5.4 3.1 Z"
        fill="url(#bus-glass)"
      />
      <circle cx="7.4" cy="-1.7" r="0.6" fill="#ffe9a8" />
      <circle cx="7.4" cy="1.7" r="0.6" fill="#ffe9a8" />
    </>
  );
}

// Ferry: a hull with a pointed bow at the front and a route-coloured
// superstructure amidships.
function FerryBody({ color }) {
  return (
    <>
      <defs>
        <clipPath id="ferry-clip">
          <path d="M -11.5 -4.6 L 5 -4.6 Q 10.5 -4.2 13 0 Q 10.5 4.2 5 4.6 L -11.5 4.6 Q -12.8 4.6 -12.8 3.2 L -12.8 -3.2 Q -12.8 -4.6 -11.5 -4.6 Z" />
        </clipPath>
      </defs>
      <ellipse cx="-0.5" cy="4.2" rx="12" ry="2.6" fill="rgba(10, 14, 20, 0.28)" />
      {/* White hull, pointed bow to the right. */}
      <path
        d="M -11.5 -4.6 L 5 -4.6 Q 10.5 -4.2 13 0 Q 10.5 4.2 5 4.6 L -11.5 4.6 Q -12.8 4.6 -12.8 3.2 L -12.8 -3.2 Q -12.8 -4.6 -11.5 -4.6 Z"
        fill="url(#bus-body)"
        stroke="rgba(20, 25, 32, 0.35)"
        strokeWidth="0.5"
      />
      <g clipPath="url(#ferry-clip)">
        {/* Deck trim and route-coloured cabin block amidships. */}
        <rect x="-11" y="-4.6" width="24" height="1.1" fill={color} opacity="0.9" />
        <rect x="-11" y="3.5" width="24" height="1.1" fill={color} opacity="0.9" />
        <rect x="-8" y="-3" width="12.5" height="6" rx="1.4" fill={color} opacity="0.95" />
        <rect x="-7.2" y="-2.2" width="1.8" height="4.4" rx="0.5" fill="rgba(255,255,255,0.55)" />
        <rect x="-4.6" y="-2.2" width="1.8" height="4.4" rx="0.5" fill="rgba(255,255,255,0.55)" />
        <rect x="-2" y="-2.2" width="1.8" height="4.4" rx="0.5" fill="rgba(255,255,255,0.55)" />
      </g>
      {/* Bow highlight. */}
      <path d="M 8 -1.6 Q 11 -0.9 11.6 0 Q 11 0.9 8 1.6 Z" fill="rgba(255,255,255,0.35)" />
    </>
  );
}
