import { parseAmexCreditCard } from 'shared';
import { commitCardStatement } from 'shared';
import { emptyLedger } from 'shared';

const SAMPLE = `
Blue Cash Preferred® from American Express
Screen Reader Optimized version
www.americanexpress.com/pbc
Account Ending 9-86007
Closing Date 10/23/26
Payment Summary
New Balance     $208.37
Account Summary
Equals New Balance      $208.37
Credit Summary
Credit Limit    $13,200.00
Days in Billing Period: 30
Payments Details
Date    Description     Amount
09/28/26*       ONLINE PAYMENT - THANK YOU      -$102.37
New Charges Details
Date    Description     Amount
09/24/26        DOCKER, INC. PALO ALTO CA       $11.00
+14159410376
09/26/26        EXAMPLE SAAS SAN FRANCISCO CA   $4.19
10/01/26        Example Cloud Billing WA        $5.29
WEB SERVICES
10/23/26        ANNUAL FEE      $95.00
Total Fees for this Period      $95.00
Interest Charged
Total Interest Charged for this Period  $0.00
About Trailing Interest
Interest Charge Calculation
`

describe('parseAmexCreditCard', () => {
  it('reads mask, product, balance, limit, and inverted amounts', () => {
    const parsed = parseAmexCreditCard(SAMPLE)
    expect(parsed.parser).toBe('american-express-card')
    expect(parsed.mask).toBe('86007')
    expect(parsed.name).toBe('Amex Blue Cash Preferred')
    expect(parsed.newBalance).toBe('208.37')
    expect(parsed.creditLimit).toBe('13200.00')
    expect(parsed.transactions).toHaveLength(5)
    expect(parsed.transactions[0]).toMatchObject({
      description: 'ONLINE PAYMENT - THANK YOU',
      amount: '102.37',
      category: 'Payment',
    })
    expect(parsed.transactions[1].amount).toBe('-11.00')
    expect(parsed.transactions[4]).toMatchObject({
      description: 'ANNUAL FEE',
      amount: '-95.00',
      category: 'Fee',
    })
    expect(parsed.transactions[1].postedAt.startsWith('2026-09-24')).toBe(true)
    expect(parsed.periodEnd?.startsWith('2026-10-23')).toBe(true)
    expect(parsed.periodStart?.startsWith('2026-09-24')).toBe(true)
  })

  it('skips phone and category continuation lines', () => {
    const parsed = parseAmexCreditCard(SAMPLE)
    expect(parsed.transactions.some((row) => /^\+?\d{10,}/.test(row.description))).toBe(false)
    expect(parsed.transactions.some((row) => row.description === 'WEB SERVICES')).toBe(false)
  })
})

describe('commitCardStatement (amex)', () => {
  it('creates the card when the mask is new', () => {
    const snapshot = emptyLedger()
    const parsed = parseAmexCreditCard(SAMPLE)
    const result = commitCardStatement(snapshot, parsed)
    expect(result.status).toBe('imported')
    if (result.status !== 'imported') return
    expect(result.result.createdAccount).toBe(true)
    expect(snapshot.accounts[0]?.mask).toBe('86007')
    expect(snapshot.transactions).toHaveLength(5)
  })
})
