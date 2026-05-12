let excelUtilsPromise: Promise<typeof import('./excel')> | null = null;

export const getExcelUtils = () => {
  if (!excelUtilsPromise) excelUtilsPromise = import('./excel');
  return excelUtilsPromise;
};
