import { parseBohBankStatement } from 'shared';
import { commitBankStatement } from 'shared';
import { emptyLedger } from 'shared';

const SAMPLE = `
Statement of Account
Last statement: August 31, 2026 Primary Account:        1234
This statement: September 30, 2026      Page    1 of 3
Total days in statement period: 30
BANK OF HAWAII
www.boh.com/agreements
SUMMARY OF ACCOUNT BALANCES
Account Number  Ending Balance
Bankohana - Level III Checking  1234    $2,030.55
Bankohana Bonus Rate Savings    5678    $9,748.70
Bankohana - II/III/CA Savings   9012    $71,186.69
Bankohana - Level III Checking  Bankohana - Level III Checking
Account number  1234    Beginning balance       $5,004.91
Low balance     $2,030.52       Total additions .03
Average balance $3,316.48       Total subtractions      2,974.39
Ending balance  $ 2,030.55
DEBITS
Date    Description     Subtractions
09-01   ACH Debit       644.52
EXAMPLE MORTGAGE PYMT 090126    1001
09-01   Automatic Transfer      25.00
TRANSFER TO DEPOSIT SYSTEM ACCOUNT
78
09-01   Automatic Transfer      200.00
TRANSFER TO DEPOSIT SYSTEM ACCOUNT
12
09-11   ACH Debit       1,076.55
EXAMPLE CREDIT CRD EPAY WEB 260910
09-24   ACH Debit       195.92
EXAMPLE CARD US CREDITCARD WEB
5565
09-29   ACH Debit       832.40
EXAMPLE ASSOCIATION PURCHASE WEB 260927
CREDITS
Date    Description     Additions
09-30   Interest Payment        0.03
DAILY BALANCES
Date    Amount
08-31   5,004.91
INTEREST INFORMATION
Annual percentage yield earned  0.01%
Bankohana Bonus Rate Savings    Bankohana Bonus Rate Savings
Account number  6003-125678
Low balance     $9,748.38
Average balance $9,748.38
DAILY ACTIVITY
Date    Description     Additions       Subtractions    Balance
08-31   Beginning Balance       $9,723.38
09-01   Automatic Transfer      25.00   9,748.38
TRANSFER FROM DEPOSIT SYSTEM
ACCOUNT 1234
09-30   Bonus Int Payment       .16     9,748.54
BONUS RATE INT
09-30   Interest Payment        .16     9,748.70
09-30   Ending Totals   25.32   .00     $9,748.70
INTEREST INFORMATION
Annual percentage yield earned  0.04%
Bankohana - II/III/CA Savings   Bankohana - II/III/CA Savings
Account number  9012
Low balance     $71,234.93
Average balance $71,234.93
DAILY ACTIVITY
Date    Description     Additions       Subtractions    Balance
08-31   Beginning Balance       $71,034.93
09-01   Automatic Transfer      200.00  71,234.93
TRANSFER FROM DEPOSIT SYSTEM
ACCOUNT 1234
09-15   ACH Debit       50.00   71,184.93
EXAMPLE WITHDRAWAL
09-30   Interest Payment        1.76    71,186.69
09-30   Ending Totals   201.76  50.00     $71,186.69
INTEREST INFORMATION
Annual percentage yield earned  0.03%
`;

describe('parseBohBankStatement', () => {
  it('reads three accounts without inverting bank signs', () => {
    const parsed = parseBohBankStatement(SAMPLE);
    expect(parsed.parser).toBe('boh-bank');
    expect(parsed.accounts).toHaveLength(3);
    expect(parsed.periodStart?.startsWith('2026-08-31')).toBe(true);
    expect(parsed.periodEnd?.startsWith('2026-09-30')).toBe(true);

    const checking = parsed.accounts[0]!;
    expect(checking).toMatchObject({
      name: 'Bank of Hawaii Checking',
      mask: '1234',
      subtype: 'Checking',
      newBalance: '2030.55',
    });
    expect(checking.transactions).toHaveLength(7);
    expect(checking.transactions[0]).toMatchObject({
      description: 'ACH Debit EXAMPLE MORTGAGE PYMT 090126 1001',
      amount: '-644.52',
    });
    expect(checking.transactions[1]).toMatchObject({
      description: 'Automatic Transfer TRANSFER TO DEPOSIT SYSTEM ACCOUNT',
      amount: '-25.00',
      category: 'Transfer',
    });
    expect(checking.transactions[6]).toMatchObject({
      description: 'Interest Payment',
      amount: '0.03',
      category: 'Interest',
    });
    expect(checking.transactions[0].postedAt.startsWith('2026-09-01')).toBe(true);

    const bonus = parsed.accounts[1]!;
    expect(bonus).toMatchObject({
      name: 'Bank of Hawaii Bonus Savings',
      mask: '6003-125678',
      subtype: 'Savings',
      newBalance: '9748.70',
    });
    expect(bonus.transactions.map((row) => row.amount)).toEqual(['25.00', '0.16', '0.16']);
    expect(bonus.transactions[0].description).toContain('TRANSFER FROM DEPOSIT SYSTEM ACCOUNT 1234');

    const savings = parsed.accounts[2]!;
    expect(savings.mask).toBe('9012');
    expect(savings.newBalance).toBe('71186.69');
    expect(savings.transactions.map((row) => row.amount)).toEqual(['200.00', '-50.00', '1.76']);
  });
});

describe('commitBankStatement (boh)', () => {
  it('creates missing bank accounts from the statement masks', () => {
    const snapshot = emptyLedger();
    const parsed = parseBohBankStatement(SAMPLE);
    const result = commitBankStatement(snapshot, parsed);
    expect(result.status).toBe('imported');
    if (result.status !== 'imported') return;
    expect(result.result.createdAccounts).toBe(3);
    expect(snapshot.accounts.map((row) => row.mask)).toEqual(['1234', '6003-125678', '9012']);
    expect(snapshot.accounts.every((row) => row.kind === 'bank')).toBe(true);
    expect(snapshot.transactions).toHaveLength(13);
  });

  it('asks on overlapping re-import and replaces when confirmed', () => {
    const snapshot = emptyLedger();
    const parsed = parseBohBankStatement(SAMPLE);
    commitBankStatement(snapshot, parsed);
    const again = commitBankStatement(snapshot, parsed);
    expect(again.status).toBe('overlap');
    if (again.status !== 'overlap') return;
    expect(again.overlap.overlapCount).toBe(13);
    expect(snapshot.transactions).toHaveLength(13);
    const replaced = commitBankStatement(snapshot, parsed, { confirm: 'replace' });
    expect(replaced.status).toBe('imported');
    expect(snapshot.transactions).toHaveLength(13);
  });
});

const EXTRACT = `
Statement	of	Account
Last	statement:	August	31,	2026	Primary	Account:	0001-123456
This	statement:	September	30,	2026	Page	Page	1	1	of	of	4	4
T	otal	days	in	statement	period:	30	Number	of	Enclosures:	(	0)
BANK	OF	HA	W	AII
w	w	w	w	w	w	.boh.c	.boh.c	om/	om/	agr	agr	eemen	eemen	ts	ts	Direct	inquiries	to:
SUMMAR	Y	OF	ACCOUNT	BALANCES
Account	Number	Ending	Balance
Bankohana	-	Level	III	Checking	0001-123456	$2,030.55
Bankohana	Bonus	Rate	Savings	0002-123456	$9,748.70
Bankohana	-	II/III/CA	Savings	0003-123456	$71,236.69
B	B	B	B	a	a	a	a	n	n	n	n	k	k	k	k	o	o	o	o	h	h	h	h	a	a	a	a	n	n	n	n	a	a	a	a	-	-	-	-	L	L	L	L	e	e	e	e	v	v	v	v	e	e	e	e	l	l	l	l	I	I	I	I	I	I	I	I	I	I	I	I	C	C	C	C	h	h	h	h	e	e	e	e	c	c	c	c	k	k	k	k	i	i	i	i	n	n	n	n	g	g	g	g
Account	number	0001-123456	Beginning	balance	$5,004.91
Low	balance	$2,030.52	T	otal	additions	.03
A	verage	balance	$3,316.48	T	otal	subtractions	2,974.39
Ending	balance	$	2,030.55
D	E	B	I	T	S
D	a	t	e	D	e	s	c	r	i	p	t	i	o	n	S	u	b	t	r	a	c	t	i	o	n	s
09-01	ACH	Debit	644.52
FIRST	HA	WN	BANK	MOR	TG	PYMT	123456
09-01	Automatic	T	ransfer	25.00
TRANSFER	T	O	DEPOSIT	SYSTEM	ACCOUNT
1231231234
09-01	Automatic	T	ransfer	200.00
TRANSFER	T	O	DEPOSIT	SYSTEM	ACCOUNT
1231231234
09-1	1	ACH	Debit	1,076.55
CHASE	CREDIT	CRD	EP	A	Y	WEB	260910
1231231234
Page	Page	2	2	of	of	4	4
September	30,	2026	0001-123456
D	a	t	e	D	e	s	c	r	i	p	t	i	o	n	S	u	b	t	r	a	c	t	i	o	n	s
09-24	ACH	Debit	195.92
BARCLA	YCARD	US	CREDITCARD	WEB
1231231234
09-29	ACH	Debit	832.40
ASSOCIA	TION	OF	A	PURCHASE	WEB	260927
C	R	E	D	I	T	S
D	a	t	e	D	e	s	c	r	i	p	t	i	o	n	A	d	d	i	t	i	o	n	s
09-30	Interest	Payment	0.03
D	A	I	L	Y	B	A	L	A	N	C	E	S
08-31	5,004.91
I	N	T	E	R	E	S	T	I	N	F	O	R	M	A	T	I	O	N
B	B	B	B	a	a	a	a	n	n	n	n	k	k	k	k	o	o	o	o	h	h	h	h	a	a	a	a	n	n	n	n	a	a	a	a	B	B	B	B	o	o	o	o	n	n	n	n	u	u	u	u	s	s	s	s	R	R	R	R	a	a	a	a	t	t	t	t	e	e	e	e	S	S	S	S	a	a	a	a	v	v	v	v	i	i	i	i	n	n	n	n	g	g	g	g	s	s	s	s
Account	number	0002-123456
D	A	I	L	Y	A	C	T	I	V	I	T	Y
08-31	Beginning	Balance	$9,723.38
09-01	Automatic	T	ransfer	25.00	9,748.38
TRANSFER	FROM	DEPOSIT	SYSTEM
ACCOUNT	1231231234
09-30	Bonus	Int	Payment	.16	9,748.54
BONUS	RA	TE	INT
09-30	Interest	Payment	.16	9,748.70
09-30	E	n	d	i	n	g	T	o	t	a	l	s	2	5	.	3	2	.	0	0	$	9	,	7	4	8	.	7	0
I	N	T	E	R	E	S	T	I	N	F	O	R	M	A	T	I	O	N
Account	number	0003-123456
D	A	I	L	Y	A	C	T	I	V	I	T	Y
08-31	Beginning	Balance	$71,034.93
09-01	Automatic	T	ransfer	200.00	71,234.93
TRANSFER	FROM	DEPOSIT	SYSTEM
ACCOUNT	1231231234
09-30	Interest	Payment	1.76	71,236.69
09-30	E	n	d	i	n	g	T	o	t	a	l	s	2	0	1	.	7	6	.	0	0	$	7	1	,	2	3	6	.	6	9
`;

describe('parseBohBankStatement (tab extract)', () => {
  it('reads the letter-spaced pdf.js extract without inverting signs', () => {
    const parsed = parseBohBankStatement(EXTRACT);
    expect(parsed.accounts.map((row) => row.mask)).toEqual([
      '0001-123456',
      '0002-123456',
      '0003-123456',
    ]);
    const checking = parsed.accounts[0]!;
    expect(checking.newBalance).toBe('2030.55');
    expect(checking.transactions).toHaveLength(7);
    expect(checking.transactions[0]).toMatchObject({
      description: 'ACH Debit FIRST HAWN BANK MORTG PYMT 123456',
      amount: '-644.52',
    });
    expect(checking.transactions[1]).toMatchObject({
      amount: '-25.00',
      category: 'Transfer',
    });
    expect(checking.transactions[3]).toMatchObject({
      description: expect.stringContaining('CHASE CREDIT CRD EPAY WEB 260910'),
      amount: '-1076.55',
    });
    expect(checking.transactions[3].postedAt.startsWith('2026-09-11')).toBe(true);
    expect(checking.transactions[4].description).toContain('BARCLAYCARD');
    expect(checking.transactions[5].description).toContain('ASSOCIATION OF A PURCHASE');
    expect(checking.transactions[6]).toMatchObject({ amount: '0.03', category: 'Interest' });

    const bonus = parsed.accounts[1]!;
    expect(bonus.name).toBe('Bank of Hawaii Bonus Savings');
    expect(bonus.newBalance).toBe('9748.70');
    expect(bonus.transactions.map((row) => row.amount)).toEqual(['25.00', '0.16', '0.16']);

    const savings = parsed.accounts[2]!;
    expect(savings.newBalance).toBe('71236.69');
    expect(savings.transactions.map((row) => row.amount)).toEqual(['200.00', '1.76']);
  });
});
