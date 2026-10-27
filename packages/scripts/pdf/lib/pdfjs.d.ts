declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export function getDocument(options: {
    data: Uint8Array
    disableWorker?: boolean
    isEvalSupported?: boolean
    useSystemFonts?: boolean
  }): {
    promise: Promise<{
      numPages: number
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string; transform?: number[] }> }>
      }>
    }>
  }
}
