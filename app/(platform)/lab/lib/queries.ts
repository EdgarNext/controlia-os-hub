import type { LabPoint } from "./types";

export async function getLabChartSeries(): Promise<LabPoint[]> {
  return [
    { name: "Mon", value: 42 },
    { name: "Tue", value: 58 },
    { name: "Wed", value: 37 },
    { name: "Thu", value: 66 },
    { name: "Fri", value: 54 },
  ];
}
