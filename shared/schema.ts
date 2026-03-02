import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // We'll use email here
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("User"), // 'Super Admin' | 'User'
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(), // ISO date string or formatted date
  amount: numeric("amount").notNull(), // INR is standard numeric
  paidTo: text("paid_to").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  remarks: text("remarks"),
  paymentProofUrl: text("payment_proof_url"),
  invoiceUrl: text("invoice_url"),
  status: text("status").notNull().default("Pending"), // 'Pending' | 'Approved' | 'Rejected'
  createdAt: timestamp("created_at").defaultNow(),
});

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, userId: true, status: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Expense = typeof expenses.$inferSelect;
// We attach user info to expense for the UI
export type ExpenseWithUser = Expense & { user?: User };
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
