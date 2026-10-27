import { parseChaseCreditCard } from './chase-card'
import { commitCardStatement } from './import-card'
import { emptyLedger } from '../ledger'

const SAMPLE = `
Make your payment at
chase.com/paycard
Account Number: XXXX XXXX XXXX 3525
New Balance 	$4,667.81
Opening/Closing Date 	09/09/26 - 10/08/26
Credit Access Line 	$29,500
Reward your routine everywhere you shop with your Prime Visa.
Statement Date: 	10/08/26
Date of
Transaction 	Merchant Name or Transaction Description 	$ Amount
09/28 	Payment Thank You - Web 	-5,161.27
09/09 	TST* JAMBA JUICE - 541 - MILLANI HI 	10.77
09/09 	AMAZON MKTPL*ABC Amzn.com/bill WA 	18.82
Order Number 	111-0000000-0000000
09/27 	TST*JAMBA JUICE - 541 - Millani HI 	.52
Total fees charged in 2026 	$0.00
Annual Percentage Rate (APR)
`

describe('parseChaseCreditCard', () => {
  it('reads mask, balance, product, and inverted amounts', () => {
    const parsed = parseChaseCreditCard(SAMPLE)
    expect(parsed.mask).toBe('3525')
    expect(parsed.name).toBe('Chase Prime Visa')
    expect(parsed.newBalance).toBe('4667.81')
    expect(parsed.transactions).toHaveLength(4)
    expect(parsed.transactions[0]).toMatchObject({
      description: 'Payment Thank You - Web',
      amount: '5161.27',
      category: 'Payment',
    })
    expect(parsed.transactions[1].amount).toBe('-10.77')
    expect(parsed.transactions[3].amount).toBe('-0.52')
    expect(parsed.transactions[1].postedAt.startsWith('2026-09-09')).toBe(true)
  })

  it('skips order-number continuation lines', () => {
    const parsed = parseChaseCreditCard(SAMPLE)
    expect(parsed.transactions.some((row) => /order number/i.test(row.description))).toBe(false)
  })
})

describe('commitCardStatement', () => {
  it('creates the card when the mask is new', () => {
    const snapshot = emptyLedger()
    const parsed = parseChaseCreditCard(SAMPLE)
    const result = commitCardStatement(snapshot, parsed)
    expect(result.status).toBe('imported')
    if (result.status !== 'imported') return
    expect(result.result.createdAccount).toBe(true)
    expect(snapshot.accounts).toHaveLength(1)
    expect(snapshot.accounts[0]?.mask).toBe('3525')
    expect(snapshot.transactions).toHaveLength(4)
    expect(snapshot.accounts[0]?.balance).toBe('4667.81')
  })

  it('asks on overlapping re-import', () => {
    const snapshot = emptyLedger()
    const parsed = parseChaseCreditCard(SAMPLE)
    commitCardStatement(snapshot, parsed)
    const again = commitCardStatement(snapshot, parsed)
    expect(again.status).toBe('overlap')
    if (again.status !== 'overlap') return
    expect(again.overlap.overlapCount).toBe(4)
    expect(snapshot.transactions).toHaveLength(4)
  })

  it('replaces overlapping rows when confirmed', () => {
    const snapshot = emptyLedger()
    const parsed = parseChaseCreditCard(SAMPLE)
    commitCardStatement(snapshot, parsed)
    const replaced = commitCardStatement(snapshot, parsed, { confirm: 'replace' })
    expect(replaced.status).toBe('imported')
    expect(snapshot.transactions).toHaveLength(4)
  })
})
