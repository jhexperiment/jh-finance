declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export const GlobalWorkerOptions: { workerSrc: string }
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

declare module 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url' {
  const workerSrc: string
  export default workerSrc
}
