import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Email is required")
  .email("Enter a valid email");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one digit");

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Full name is required")
  .max(80, "Full name must be 80 characters or fewer");

export const signupSchema = z.object({
  full_name: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Group name is required")
  .max(50, "Group name must be 50 characters or fewer");

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(3, "Currency code must be 3 letters");

export const createGroupSchema = z.object({
  name: groupNameSchema,
  primary_currency: currencyCodeSchema,
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const expenseNameSchema = z
  .string()
  .trim()
  .min(1, "Expense name is required")
  .max(100, "Expense name must be 100 characters or fewer");

// Integer-only amount: accepts a string from the form input, validates digits only.
export const integerAmountSchema = z
  .string()
  .regex(/^\d+$/, "Amount must be a whole number")
  .transform((s) => BigInt(s))
  .refine((n) => n > 0n, { message: "Amount must be greater than zero" });

export const createExpenseSchema = z.object({
  group_id: z.string().uuid(),
  name: expenseNameSchema,
  amount: integerAmountSchema,
  currency: currencyCodeSchema,
  paid_by: z.string().uuid(),
  participants: z
    .array(z.string().uuid())
    .min(1, "Pick at least one participant"),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const repaymentItemSchema = z.object({
  creditor_id: z.string().uuid(),
  amount: integerAmountSchema,
  currency: currencyCodeSchema,
  description: z.string().trim().max(200).optional(),
});
export type RepaymentItemInput = z.infer<typeof repaymentItemSchema>;

export const requestRepaymentsSchema = z.object({
  group_id: z.string().uuid(),
  items: z.array(repaymentItemSchema).min(1, "Pick at least one creditor"),
  idempotency_key: z.string().uuid(),
});
