import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type {
  CreateAccountInput,
  CreateBillInput,
  CreateHoldingInput,
  CreateTransactionInput,
  UpdateAccountInput,
  UpdateBillInput,
  UpdateHoldingInput,
  UpdateTransactionInput,
} from 'shared';

const accountKind = z.enum(['credit-card', 'bank', 'investment', 'crypto']);
const billKind = z.enum(['utility', 'insurance']);

const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: accountKind,
  subtype: z.string().trim().max(80).optional(),
  mask: z.string().trim().max(12).optional(),
  balance: z.string().optional(),
});

const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  subtype: z.string().trim().max(80).optional(),
  mask: z.string().trim().max(12).nullable().optional(),
  balance: z.string().optional(),
});

const createTransactionSchema = z.object({
  accountId: z.string().min(1),
  postedAt: z.string().optional(),
  description: z.string().trim().min(1).max(200),
  amount: z.string().min(1),
  category: z.string().trim().max(80).optional(),
  status: z.string().trim().max(40).optional(),
});

const updateTransactionSchema = z.object({
  postedAt: z.string().optional(),
  description: z.string().trim().min(1).max(200).optional(),
  amount: z.string().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  status: z.string().trim().max(40).nullable().optional(),
});

const createHoldingSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  symbol: z.string().trim().max(20).optional(),
  quantity: z.string().optional(),
  value: z.string().min(1),
  costBasis: z.string().optional(),
});

const updateHoldingSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  symbol: z.string().trim().max(20).nullable().optional(),
  quantity: z.string().optional(),
  value: z.string().optional(),
  costBasis: z.string().optional(),
});

const createBillSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: billKind,
  amount: z.string().optional(),
  dueAt: z.string().optional(),
  paidFromId: z.string().optional(),
  status: z.string().trim().max(40).optional(),
});

const updateBillSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  amount: z.string().optional(),
  dueAt: z.string().nullable().optional(),
  paidFromId: z.string().nullable().optional(),
  status: z.string().trim().max(40).optional(),
});

export function parseCreateAccount(body: unknown): CreateAccountInput {
  return parse(createAccountSchema, body);
}

export function parseUpdateAccount(body: unknown): UpdateAccountInput {
  return parse(updateAccountSchema, body);
}

export function parseCreateTransaction(body: unknown): CreateTransactionInput {
  return parse(createTransactionSchema, body);
}

export function parseUpdateTransaction(body: unknown): UpdateTransactionInput {
  return parse(updateTransactionSchema, body);
}

export function parseCreateHolding(body: unknown): CreateHoldingInput {
  return parse(createHoldingSchema, body);
}

export function parseUpdateHolding(body: unknown): UpdateHoldingInput {
  return parse(updateHoldingSchema, body);
}

export function parseCreateBill(body: unknown): CreateBillInput {
  return parse(createBillSchema, body);
}

export function parseUpdateBill(body: unknown): UpdateBillInput {
  return parse(updateBillSchema, body);
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException(result.error.issues[0]?.message ?? 'Invalid request');
  }
  return result.data;
}
