export interface CliOptions {
  output: string;
  maxArrayLength?: number;
  includes?: string;
  excludes?: string;
  baseUrl?: string | true;
}

export type ImportFilePathType = {
  fileName: string;
  apiHandlerName: string;
};
