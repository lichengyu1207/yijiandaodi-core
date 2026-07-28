/// <reference types="vite/client" />

declare module '@microsoft/presidio-analyzer-nodejs-bundle' {
  export const AnalyzerEngine: any;
  export const RecognizerResult: any;
}

declare module 'pyodide' {
  export function loadPyodide(options?: any): Promise<any>;
}
