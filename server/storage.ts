import { db } from "./db";
import { 
  users, 
  expenses,
  type User, 
  type InsertUser, 
  type Expense, 
  type InsertExpense,
  type ExpenseWithUser
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
}

export const storage = new DatabaseStorage();
