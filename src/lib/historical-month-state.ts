type HistoricalMonthlyUiStateInput = {
  status?: string;
  isHistorical: boolean;
  hasSavedPeriod: boolean;
  canManage: boolean;
  dataLoadError: boolean;
};

export function resolveHistoricalMonthlyUiState({
  status,
  isHistorical,
  hasSavedPeriod,
  canManage,
  dataLoadError,
}: HistoricalMonthlyUiStateInput) {
  const isSavedHistorical = isHistorical && hasSavedPeriod;

  return {
    isSavedHistorical,
    canEditMonth: canManage && !dataLoadError && !isSavedHistorical,
    showCorrectionSuccess: status === "corrected" && isSavedHistorical,
  };
}
