/// <reference path="../pdfjs.d.ts" />

type TextItem = {
  str?: string
  transform?: number[]
}

export async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const document = await pdfjs.getDocument({
    data,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise

  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(itemsToText(content.items as TextItem[]))
  }
  return pages.join('\n')
}

function itemsToText(items: TextItem[]): string {
  const points: { x: number; y: number; str: string }[] = []
  for (const item of items) {
    const value = item.str?.trim()
    if (!value || !item.transform) continue
    points.push({
      x: item.transform[4] ?? 0,
      y: item.transform[5] ?? 0,
      str: value,
    })
  }
  points.sort((a, b) => b.y - a.y || a.x - b.x)

  const lines: { y: number; cells: { x: number; str: string }[] }[] = []
  for (const point of points) {
    const line = lines.find((row) => Math.abs(row.y - point.y) <= 3)
    if (line) {
      line.cells.push({ x: point.x, str: point.str })
      line.y = (line.y * (line.cells.length - 1) + point.y) / line.cells.length
    } else {
      lines.push({ y: point.y, cells: [{ x: point.x, str: point.str }] })
    }
  }

  return lines
    .map((line) =>
      line.cells
        .sort((a, b) => a.x - b.x)
        .map((cell) => cell.str)
        .join('\t'),
    )
    .join('\n')
}
