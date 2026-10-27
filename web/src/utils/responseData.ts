import { AnalysisPair } from "../types/aquifer";

export type ResponseSort =
  | "original"
  | "amplitude-desc"
  | "amplitude-asc"
  | "distance"
  | "period";
export function visibleResponses(
  pairs: AnalysisPair[],
  query: string,
  sort: ResponseSort,
): AnalysisPair[] {
  // Keep numbered test names together: "Test 9 W2" must not match Test 2/W9.
  // Quoted custom labels also work as phrases; remaining words are AND filters.
  const words = (
    query.toLowerCase().match(/"[^"]+"|test\s+\d+\b|\S+/g) ?? []
  ).map((word) => word.replace(/^"|"$/g, ""));
  const filtered = pairs.filter((pair) => {
    const text = [
      pair.testName,
      pair.testId,
      pair.pumpingWellName,
      pair.observationWellName,
      pair.periodSeconds,
    ]
      .join(" ")
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
  if (sort === "original") return filtered;
  return filtered.sort((a, b) =>
    sort === "distance"
      ? a.distanceMeters - b.distanceMeters
      : sort === "period"
        ? a.periodSeconds - b.periodSeconds
        : (sort === "amplitude-asc" ? 1 : -1) *
          (a.predicted.amplitude - b.predicted.amplitude),
  );
}

/** Full-precision CSV; quoting protects labels, and spreadsheets must not
 * execute user-entered well/test names as formulas when opened. */
export function responseCsv(pairs: AnalysisPair[]) {
  const cell = (value: string | number) => {
    const text =
      typeof value === "string" && /^[=+\-@\t\r]/.test(value)
        ? `'${value}`
        : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    "testId,testName,pump,observer,periodSeconds,predictedReal,predictedImag,amplitude,phaseDegrees,measuredReal,measuredImag",
    ...pairs.map((p) =>
      [
        p.testId,
        p.testName,
        p.pumpingWellName,
        p.observationWellName,
        p.periodSeconds,
        p.predicted.real,
        p.predicted.imag,
        p.predicted.amplitude,
        p.numericalPhaseDegrees ?? p.predicted.phaseDegrees,
        p.measured?.real ?? "",
        p.measured?.imag ?? "",
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
}
