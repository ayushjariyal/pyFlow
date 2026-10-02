// A tiny in-browser CSV for trying the platform without a file on hand.

const SAMPLE = ["id,name,age", "1,Alice,25", "2,Bob,30", "3,,25", "4,Dana,40", ""].join("\n");

export function sampleCsvFile(): File {
  return new File([SAMPLE], "sample.csv", { type: "text/csv" });
}
