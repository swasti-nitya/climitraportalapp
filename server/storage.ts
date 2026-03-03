import { db } from "./db";
import { 
  users, 
  expenses,
  leaves,
  holidays,
  type User, 
  type InsertUser, 
  type Expense, 
  type InsertExpense,
  type ExpenseWithUser,
  type Leave,
  type InsertLeave,
  type LeaveWithUser,
  type Holiday,
  type InsertHoliday
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Expense operations
  getExpenses(): Promise<ExpenseWithUser[]>;
  getExpensesByUserId(userId: number): Promise<ExpenseWithUser[]>;
  createExpense(expense: InsertExpense): Promise<ExpenseWithUser>;
  updateExpenseStatus(id: number, status: string): Promise<ExpenseWithUser | undefined>;

  // Leave operations
  getLeaves(): Promise<LeaveWithUser[]>;
  getLeavesByUserId(userId: number): Promise<LeaveWithUser[]>;
  createLeave(leave: InsertLeave): Promise<LeaveWithUser>;
  updateLeaveStatus(id: number, status: string, approvedBy?: number, approvalRemark?: string): Promise<LeaveWithUser | undefined>;
  getLeaveCount(userId: number): Promise<{ totalAllowed: number; used: number; remaining: number }>;

  // Holiday operations
  getHolidays(): Promise<Holiday[]>;
  createHoliday(holiday: InsertHoliday): Promise<Holiday>;
  deleteHoliday(id: number): Promise<void>;

  // User password operations
  updateUserPassword(userId: number, newPassword: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getExpenses(): Promise<ExpenseWithUser[]> {
    const rows = await db
      .select({
        expense: expenses,
        user: users,
      })
      .from(expenses)
      .leftJoin(users, eq(expenses.userId, users.id))
      .orderBy(desc(expenses.createdAt));

    return rows.map((row) => ({
      ...row.expense,
      user: row.user || undefined,
    }));
  }

  async getExpensesByUserId(userId: number): Promise<ExpenseWithUser[]> {
    const rows = await db
      .select({
        expense: expenses,
        user: users,
      })
      .from(expenses)
      .leftJoin(users, eq(expenses.userId, users.id))
      .where(eq(expenses.userId, userId))
      .orderBy(desc(expenses.createdAt));

    return rows.map((row) => ({
      ...row.expense,
      user: row.user || undefined,
    }));
  }

  async createExpense(insertExpense: InsertExpense): Promise<ExpenseWithUser> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    const user = await this.getUser(expense.userId);
    return { ...expense, user };
  }

  async updateExpenseStatus(id: number, status: string): Promise<ExpenseWithUser | undefined> {
    const [expense] = await db
      .update(expenses)
      .set({ status })
      .where(eq(expenses.id, id))
      .returning();
      
    if (!expense) return undefined;
    const user = await this.getUser(expense.userId);
    return { ...expense, user };
  }

  async getLeaves(): Promise<LeaveWithUser[]> {
    const rows = await db
      .select({
        leave: leaves,
        user: users,
      })
      .from(leaves)
      .leftJoin(users, eq(leaves.userId, users.id))
      .orderBy(desc(leaves.createdAt));

    return rows.map((row) => ({
      ...row.leave,
      user: row.user || undefined,
    }));
  }

  async getLeavesByUserId(userId: number): Promise<LeaveWithUser[]> {
    const rows = await db
      .select({
        leave: leaves,
        user: users,
      })
      .from(leaves)
      .leftJoin(users, eq(leaves.userId, users.id))
      .where(eq(leaves.userId, userId))
      .orderBy(desc(leaves.createdAt));

    return rows.map((row) => ({
      ...row.leave,
      user: row.user || undefined,
    }));
  }

  async createLeave(insertLeave: InsertLeave): Promise<LeaveWithUser> {
    const [leave] = await db.insert(leaves).values(insertLeave).returning();
    const user = await this.getUser(leave.userId);
    return { ...leave, user };
  }

  async updateLeaveStatus(id: number, status: string, approvedBy?: number, approvalRemark?: string): Promise<LeaveWithUser | undefined> {
    const updateData: any = { status };
    if (approvedBy) updateData.approvedBy = approvedBy;
    if (approvalRemark) updateData.approvalRemark = approvalRemark;

    const [leave] = await db
      .update(leaves)
      .set(updateData)
      .where(eq(leaves.id, id))
      .returning();
      
    if (!leave) return undefined;
    const user = await this.getUser(leave.userId);
    return { ...leave, user };
  }

  async getLeaveCount(userId: number): Promise<{ totalAllowed: number; used: number; remaining: number }> {
    const user = await this.getUser(userId);
    if (!user) return { totalAllowed: 0, used: 0, remaining: 0 };

    const userLeaves = await db
      .select()
      .from(leaves)
      .where(eq(leaves.userId, userId));

    const approvedLeaves = userLeaves
      .filter(l => l.status === 'Approved' && l.type === 'Leave')
      .reduce((sum, l) => sum + l.numberOfDays, 0);

    return {
      totalAllowed: user.totalLeavesAllowed,
      used: approvedLeaves,
      remaining: user.totalLeavesAllowed - approvedLeaves,
    };
  }

  async getHolidays(): Promise<Holiday[]> {
    return await db.select().from(holidays).orderBy(holidays.date);
  }

  async createHoliday(insertHoliday: InsertHoliday): Promise<Holiday> {
    const [holiday] = await db.insert(holidays).values(insertHoliday).returning();
    return holiday;
  }

  async deleteHoliday(id: number): Promise<void> {
    await db.delete(holidays).where(eq(holidays.id, id));
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<void> {
    await db.update(users)
      .set({ password: newPassword })
      .where(eq(users.id, userId));
  }
}

export const storage = new DatabaseStorage();
