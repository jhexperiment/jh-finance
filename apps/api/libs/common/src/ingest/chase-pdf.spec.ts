import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseChaseCreditCard } from 'shared';
import { extractPdfText } from './pdf-text';

const sample = path.resolve(__dirname, '../../../../../../tmp/20261008-statements-3525- copy.pdf');

// pdfjs-dist is ESM-only; Jest 30 still loads it via require(). Parse the sample with node/tsx instead.
const describeSample = describe.skip;

describeSample('Chase sample PDF', () => {
  it('creates parseable text with the masked card and purchases', async () => {
    const text = await extractPdfText(new Uint8Array(readFileSync(sample)));
    const parsed = parseChaseCreditCard(text);
    expect(parsed.mask).toBe('3525');
    expect(parsed.name).toMatch(/Chase/);
    expect(parsed.transactions.length).toBeGreaterThan(20);
    expect(parsed.transactions.some((row) => row.category === 'Payment')).toBe(true);
  });
});
