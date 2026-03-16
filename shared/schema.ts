import { pgTable, text, serial, integer, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // We'll use email here
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("User"), // 'Super Admin' | 'User'
  totalLeavesAllowed: integer("total_leaves_allowed").notNull().default(30),
  joiningDate: text("joining_date"), // ISO date string
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
  isFlagged: boolean("is_flagged").notNull().default(false),
  flagReason: text("flag_reason"),
  mealParticipantCount: integer("meal_participant_count").notNull().default(1),
  mealParticipants: text("meal_participants"),
  stayParticipantCount: integer("stay_participant_count").notNull().default(1),
  stayCheckIn: text("stay_check_in"),
  stayCheckOut: text("stay_check_out"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leaves = pgTable("leaves", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  startDate: text("start_date").notNull(), // ISO date string
  endDate: text("end_date").notNull(), // ISO date string
  type: text("type").notNull(), // 'Leave' | 'Work From Home'
  leaveCategory: text("leave_category"), // 'Planned' | 'Sick' (for type='Leave')
  reason: text("reason").notNull(),
  numberOfDays: integer("number_of_days").notNull(),
  status: text("status").notNull().default("Pending"), // 'Pending' | 'Approved' | 'Rejected'
  approvedBy: integer("approved_by"), // user id of admin who approved/rejected
  approvalRemark: text("approval_remark"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(), // ISO date string
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
}));

export const leavesRelations = relations(leaves, ({ one }) => ({
  user: one(users, {
    fields: [leaves.userId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [leaves.approvedBy],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, userId: true, status: true, createdAt: true, isFlagged: true });
export const insertLeaveSchema = createInsertSchema(leaves).omit({ id: true, userId: true, status: true, approvedBy: true, approvalRemark: true, createdAt: true });
export const insertHolidaySchema = createInsertSchema(holidays).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Expense = typeof expenses.$inferSelect;
// We attach user info to expense for the UI
export type ExpenseWithUser = Expense & { user?: User };
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type Leave = typeof leaves.$inferSelect;
export type LeaveWithUser = Leave & { user?: User; approver?: User };
export type InsertLeave = z.infer<typeof insertLeaveSchema>;

export type Holiday = typeof holidays.$inferSelect;
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
