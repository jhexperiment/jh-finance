import { parseCitiCreditCard } from 'shared';
import { commitCardStatement } from 'shared';
import { emptyLedger } from 'shared';

const SAMPLE = `
PO BOX 6500 SIOUX FALLS, SD 57117-6500
AT&T Universal Savings and Rewards Card
www.universalcard.com   Member Since 2013. Account number ending in: 3434
OCTOBER STATEMENT
Billing Period: 09/10/26-10/09/26
New balance as of 10/09/26:     $233.05
Minimum payment due:    $41.00
Payment due date:       11/07/26
New balance     $233.05
Credit limit    $11,700
www.citi.com
Trans.  Post
date    date    Description     Amount
Payments, Credits and Adjustments
09/28   ONLINE PAYMENT, THANK YOU       -       $233.06
10/09   AT&T Savings    -       $4.56
Standard Purchases
09/25   09/25   EXAMPLE *AUTO   WASHINGTON      DC      $146.47
09/30   09/30   EXAMPLE MOBILITY EPAY   DALLAS  TX      $91.14
Fees Charged
Total fees charged in this billing period        $0.00
Interest Charged
`

describe('parseCitiCreditCard', () => {
  it('reads mask, product, balance, limit, and inverted amounts', () => {
    const parsed = parseCitiCreditCard(SAMPLE)
    expect(parsed.parser).toBe('citi-card')
    expect(parsed.mask).toBe('3434')
    expect(parsed.name).toBe('Citi AT&T Universal')
    expect(parsed.newBalance).toBe('233.05')
    expect(parsed.creditLimit).toBe('11700.00')
    expect(parsed.transactions).toHaveLength(4)
    expect(parsed.transactions[0]).toMatchObject({
      description: 'ONLINE PAYMENT, THANK YOU',
      amount: '233.06',
      category: 'Payment',
    })
    expect(parsed.transactions[1]).toMatchObject({
      description: 'AT&T Savings',
      amount: '4.56',
      category: 'Credit',
    })
    expect(parsed.transactions[2].amount).toBe('-146.47')
    expect(parsed.transactions[2].postedAt.startsWith('2026-09-25')).toBe(true)
    expect(parsed.periodStart?.startsWith('2026-09-10')).toBe(true)
    expect(parsed.periodEnd?.startsWith('2026-10-09')).toBe(true)
  })
})

describe('commitCardStatement (citi)', () => {
  it('creates the card when the mask is new', () => {
    const snapshot = emptyLedger()
    const parsed = parseCitiCreditCard(SAMPLE)
    const result = commitCardStatement(snapshot, parsed)
    expect(result.status).toBe('imported')
    if (result.status !== 'imported') return
    expect(result.result.createdAccount).toBe(true)
    expect(snapshot.accounts[0]?.mask).toBe('3434')
    expect(snapshot.transactions).toHaveLength(4)
  })
})
