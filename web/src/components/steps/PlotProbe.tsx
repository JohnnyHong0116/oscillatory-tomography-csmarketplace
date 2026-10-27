import React, { useEffect, useRef } from "react";
import { nearestPlotPoint, ProbePoint } from "../../utils/plotProbe";
import { PlotDetails, useInspectionContext } from "./PlotInspection";

/** Full plot-area exploration, independent of a tiny marker's hit box. This
 * changes inspection only: no smoothing, resampling or scientific data edits. */
export function PlotProbe({
  points,
  left,
  top,
  width,
  height,
  dark = true,
}: {
  points: ProbePoint<PlotDetails>[];
  left: number;
  top: number;
  width: number;
  height: number;
  dark?: boolean;
}) {
  const inspection = useInspectionContext();
  const root = useRef<SVGGElement>(null);
  const find = (event: { clientX: number; clientY: number }) => {
    const svg = root.current?.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    if (
      local.x < left ||
      local.x > left + width ||
      local.y < top ||
      local.y > top + height
    )
      return null;
    return nearestPlotPoint(points, local.x, local.y);
  };
  useEffect(() => {
    const svg = root.current?.ownerSVGElement;
    if (!svg || !inspection) return;
    // Listen on the SVG, not a covering hit rectangle: individual point
    // controls remain directly clickable/focusable and never get intercepted.
    const move = (event: PointerEvent) => {
      if ((event.target as Element).closest('[role="button"]')) return;
      const point = find(event);
      inspection.hover(point?.details ?? null);
    };
    const leave = () => inspection.hover(null);
    const click = (event: MouseEvent) => {
      if ((event.target as Element).closest('[role="button"]')) return;
      const point = find(event);
      if (point) inspection.pin(point.details);
    };
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerleave", leave);
    svg.addEventListener("click", click);
    return () => {
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerleave", leave);
      svg.removeEventListener("click", click);
    };
  }, [inspection, points, left, top, width, height]);
  if (!inspection || !points.length) return null;
  const selected = points.find((p) => p.details.id === inspection.details?.id);
  const tipWidth = Math.min(250, width - 8),
    tipHeight = 68;
  const tipX = selected
    ? Math.max(
        left + 4,
        Math.min(left + width - tipWidth - 4, selected.cx + 12),
      )
    : left;
  const tipY = selected
    ? Math.max(
        top + 4,
        Math.min(top + height - tipHeight - 4, selected.cy - tipHeight - 12),
      )
    : top;
  return (
    <g ref={root}>
      <rect
        x={left}
        y={top}
        width={width}
        height={height}
        fill="transparent"
        pointerEvents="none"
        tabIndex={0}
        role="button"
        aria-label="Explore chart: move pointer, use arrow keys, Enter to pin, Escape to clear"
        className="plot-probe"
        onPointerMove={(event) => {
          const point = find(event);
          if (point) inspection.hover(point.details);
        }}
        onPointerLeave={() => inspection.hover(null)}
        onClick={(event) => {
          const point = find(event);
          if (point) inspection.pin(point.details);
        }}
        onFocus={() => {
          if (!inspection.details) inspection.hover(points[0].details);
        }}
        onBlur={() => inspection.hover(null)}
        onKeyDown={(event) => {
          const index = Math.max(
            0,
            points.findIndex((p) => p.details.id === inspection.details?.id),
          );
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
            ].includes(event.key)
          ) {
            event.preventDefault();
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? points.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        points.length - 1,
                        index +
                          (["ArrowLeft", "ArrowUp"].includes(event.key)
                            ? -1
                            : 1),
                      ),
                    );
            // Directional exploration intentionally moves a pinned selection too.
            if (next === index) return;
            if (inspection.pinned) inspection.pin(points[next].details);
            else inspection.hover(points[next].details);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inspection.pin(points[index].details);
          } else if (event.key === "Escape") {
            event.preventDefault();
            inspection.clear();
          }
        }}
      />
      {selected && (
        <g pointerEvents="none" aria-hidden="true">
          <line
            x1={selected.cx}
            x2={selected.cx}
            y1={top}
            y2={top + height}
            stroke={dark ? "#E7EDF4" : "#566372"}
            strokeOpacity=".5"
            strokeDasharray="4 4"
          />
          <line
            x1={left}
            x2={left + width}
            y1={selected.cy}
            y2={selected.cy}
            stroke={dark ? "#E7EDF4" : "#566372"}
            strokeOpacity=".35"
            strokeDasharray="4 4"
          />
          <circle
            cx={selected.cx}
            cy={selected.cy}
            r="7"
            fill="none"
            stroke={dark ? "#F8CF79" : "#C5050C"}
            strokeWidth="2"
          />
          {!inspection.pinned && (
            <>
              <rect
                x={tipX}
                y={tipY}
                width={tipWidth}
                height={tipHeight}
                rx="7"
                fill={dark ? "#F8FAFC" : "#18222D"}
                stroke={dark ? "#D9E0E7" : "#566372"}
              />
              <text
                x={tipX + 10}
                y={tipY + 17}
                fill={dark ? "#18222D" : "#fff"}
                fontSize="10"
                fontWeight="600"
              >
                {selected.details.heading.slice(0, 40)}
              </text>
              {selected.details.rows.slice(0, 2).map(([name, value], i) => (
                <text
                  key={`${name}-${i}`}
                  x={tipX + 10}
                  y={tipY + 34 + i * 15}
                  fill={dark ? "#566372" : "#E7EDF4"}
                  fontSize="9"
                >
                  {name}: {value}
                </text>
              ))}
            </>
          )}
        </g>
      )}
    </g>
  );
}
