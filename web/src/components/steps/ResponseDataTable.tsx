import React, { useState } from "react";
import { Download, Search, Table2 } from "lucide-react";
import { AnalysisPair } from "../../types/aquifer";
import {
  responseCsv,
  ResponseSort,
  visibleResponses,
} from "../../utils/responseData";
import {
  PlotDetails,
  formatPlotNumber,
  responseDetails,
  useInspectionContext,
} from "./PlotInspection";

export function ResponseDataTable({
  pairs,
  detailsFor = responseDetails,
}: {
  pairs: AnalysisPair[];
  detailsFor?: (pair: AnalysisPair) => PlotDetails;
}) {
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState<ResponseSort>("original");
  const inspection = useInspectionContext();
  const rows = visibleResponses(pairs, query, sort);
  return (
    <details className="mt-4 rounded-xl border border-[#D9E0E7] bg-white p-3">
      <summary className="w-fit cursor-pointer rounded text-sm font-semibold focus-ring">
        <Table2 size={15} className="mr-2 inline" aria-hidden="true" />
        Inspect response data ({pairs.length})
      </summary>
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search response data"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search test, well or period…"
              className="studio-input w-full"
            />
          </label>
          <select
            aria-label="Sort response data"
            value={sort}
            onChange={(e) => setSort(e.target.value as ResponseSort)}
            className="studio-input max-w-full"
          >
            <option value="original">Test order</option>
            <option value="amplitude-desc">
              Predicted amplitude: high to low
            </option>
            <option value="amplitude-asc">
              Predicted amplitude: low to high
            </option>
            <option value="distance">Distance: near to far</option>
            <option value="period">Period: short to long</option>
          </select>
          <button
            type="button"
            className="studio-button studio-button-secondary"
            disabled={!rows.length}
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([responseCsv(rows)], {
                  type: "text/csv;charset=utf-8",
                }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = "visible-response-data.csv";
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={15} aria-hidden="true" />
            Export visible rows
          </button>
        </div>
        <p className="text-xs text-[#566372]">
          {rows.length} / {pairs.length} responses · select a row to pin it in
          the plot. Search and sorting only change this table, not the
          inversion.
        </p>
        <div
          className="max-h-80 overflow-auto rounded-lg border border-[#D9E0E7]"
          tabIndex={0}
          aria-label="Response data table"
        >
          <table className="response-table w-full text-left">
            <thead className="sticky top-0 bg-[#F3F5F7]">
              <tr>
                <th>Test · pump → observer</th>
                <th>P (s)</th>
                <th>Distance (m)</th>
                <th>Predicted amp. (m)</th>
                <th>Phase (°)</th>
                <th>Real (m)</th>
                <th>Imaginary (m)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pair) => {
                const details = detailsFor(pair);
                return (
                  <tr
                    key={`${pair.testId}-${pair.observationWellId}`}
                    data-selected={inspection?.details?.id === details.id}
                    onClick={() => inspection?.pin(details)}
                  >
                    <td>
                      <button
                        type="button"
                        aria-label={`Inspect data ${pair.testName}: ${pair.pumpingWellName} to ${pair.observationWellName}`}
                        className="min-h-8 rounded text-left focus-ring"
                        onClick={(e) => {
                          e.stopPropagation();
                          inspection?.pin(details);
                        }}
                      >
                        {pair.testName}
                        <span className="ml-2 text-[#566372]">
                          {pair.pumpingWellName} → {pair.observationWellName}
                        </span>
                      </button>
                    </td>
                    <td className="font-mono">{pair.periodSeconds}</td>
                    <td className="font-mono">
                      {formatPlotNumber(pair.distanceMeters)}
                    </td>
                    <td className="font-mono">
                      {pair.predicted.amplitude.toExponential(4)}
                    </td>
                    <td className="font-mono">
                      {(
                        pair.numericalPhaseDegrees ??
                        pair.predicted.phaseDegrees
                      ).toFixed(3)}
                    </td>
                    <td className="font-mono">
                      {pair.predicted.real.toExponential(4)}
                    </td>
                    <td className="font-mono">
                      {pair.predicted.imag.toExponential(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <p className="p-5 text-sm text-[#566372]">
              No matching responses. Try a well label or clear the search.
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
