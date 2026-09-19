export type CpiSeries = {
  id: number;
  code: string;
  name: string;
  level: number;
  parentId: number | null;
  baseYear: number;
};

export type CpiObservation = {
  seriesId: number;
  periodDate: string;
  indexValue: number;
};
