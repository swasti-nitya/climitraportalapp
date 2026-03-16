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
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  
  // Expense operations
  getExpenses(): Promise<ExpenseWithUser[]>;
  getExpensesByUserId(userId: number): Promise<ExpenseWithUser[]>;
  getExpenseById(id: number): Promise<ExpenseWithUser | undefined>;
  createExpense(expense: InsertExpense & { userId: number; isFlagged?: boolean }): Promise<ExpenseWithUser>;
  updateExpense(id: number, expense: InsertExpense & { isFlagged?: boolean; flagReason?: string | null }): Promise<ExpenseWithUser | undefined>;
  updateExpenseStatus(id: number, status: string): Promise<ExpenseWithUser | undefined>;

  // Leave operations
  getLeaves(): Promise<LeaveWithUser[]>;
  getLeavesByUserId(userId: number): Promise<LeaveWithUser[]>;
  createLeave(leave: InsertLeave & { userId: number; status?: string; approvedBy?: number | null; approvalRemark?: string | null }): Promise<LeaveWithUser>;
  updateLeaveStatus(id: number, status: string, approvedBy?: number, approvalRemark?: string): Promise<LeaveWithUser | undefined>;
  getLeaveCount(userId: number): Promise<{
    cycleStart: string;
    cycleEnd: string;
    plannedTotal: number;
    plannedCarryForward: number;
    plannedUsedCurrentCycle: number;
    plannedRemaining: number;
    sickTotal: number;
    sickUsedCurrentCycle: number;
    sickRemaining: number;
    totalAllowed: number;
    used: number;
    remaining: number;
  }>;

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

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.name);
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

  async getExpenseById(id: number): Promise<ExpenseWithUser | undefined> {
    const rows = await db
      .select({
        expense: expenses,
        user: users,
      })
      .from(expenses)
      .leftJoin(users, eq(expenses.userId, users.id))
      .where(eq(expenses.id, id));

    const row = rows[0];
    if (!row) return undefined;

    return {
      ...row.expense,
      user: row.user || undefined,
    };
  }

  async createExpense(insertExpense: InsertExpense & { userId: number; isFlagged?: boolean }): Promise<ExpenseWithUser> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    const user = await this.getUser(expense.userId);
    return { ...expense, user };
  }

  async updateExpense(id: number, updatedExpense: InsertExpense & { isFlagged?: boolean; flagReason?: string | null }): Promise<ExpenseWithUser | undefined> {
    const [expense] = await db
      .update(expenses)
      .set(updatedExpense)
      .where(eq(expenses.id, id))
      .returning();

    if (!expense) return undefined;
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

  async createLeave(insertLeave: InsertLeave & { userId: number; status?: string; approvedBy?: number | null; approvalRemark?: string | null }): Promise<LeaveWithUser> {
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

  async getLeaveCount(userId: number): Promise<{
    cycleStart: string;
    cycleEnd: string;
    currentMonth: string;
    plannedTotal: number;
    plannedCarryForward: number;
    plannedUsedCurrentCycle: number;
    plannedRemaining: number;
    sickTotal: number;
    sickUsedCurrentCycle: number;
    sickRemaining: number;
    wfhTotal: number;
    wfhUsedCurrentMonth: number;
    wfhRemaining: number;
    totalAllowed: number;
    used: number;
    remaining: number;
  }> {
    const user = await this.getUser(userId);
    if (!user) {
      return {
        cycleStart: new Date().toISOString().split('T')[0],
        cycleEnd: new Date().toISOString().split('T')[0],
        currentMonth: new Date().toISOString().slice(0, 7),
        plannedTotal: 25,
        plannedCarryForward: 0,
        plannedUsedCurrentCycle: 0,
        plannedRemaining: 25,
        sickTotal: 5,
        sickUsedCurrentCycle: 0,
        sickRemaining: 5,
        wfhTotal: 2,
        wfhUsedCurrentMonth: 0,
        wfhRemaining: 2,
        totalAllowed: 32,
        used: 0,
        remaining: 32,
      };
    }

    const userLeaves = await db
      .select()
      .from(leaves)
      .where(eq(leaves.userId, userId));

    const MANUAL_BALANCE_EFFECTIVE_DATE = '2026-03-13';
    const manualStartingBalances: Record<string, { plannedRemaining: number; sickRemaining: number }> = {
      // User-provided opening balances (remaining as of effective date)
      'shrinivas@climitra.com': { plannedRemaining: 23, sickRemaining: 5 },
      'sanat@climitra.com': { plannedRemaining: 17, sickRemaining: 5 },
      'nandini@climitra.com': { plannedRemaining: 15, sickRemaining: 5 },
      'aryaman@climitra.com': { plannedRemaining: 45, sickRemaining: 5 },
      'pranav@climitra.com': { plannedRemaining: 24, sickRemaining: 5 },
      'khyati@climitra.com': { plannedRemaining: 21, sickRemaining: 5 },
      'shubhankar@climitra.com': { plannedRemaining: 25, sickRemaining: 5 },
      'aman@climitra.com': { plannedRemaining: 13, sickRemaining: 2 },
      'sanskriti@climitra.com': { plannedRemaining: 22, sickRemaining: 4 },

      // name/local-part fallbacks
      shrinivas: { plannedRemaining: 23, sickRemaining: 5 },
      sanat: { plannedRemaining: 17, sickRemaining: 5 },
      nandini: { plannedRemaining: 15, sickRemaining: 5 },
      aryaman: { plannedRemaining: 45, sickRemaining: 5 },
      pranav: { plannedRemaining: 24, sickRemaining: 5 },
      khyati: { plannedRemaining: 21, sickRemaining: 5 },
      shubhankar: { plannedRemaining: 25, sickRemaining: 5 },
      aman: { plannedRemaining: 13, sickRemaining: 2 },
      sanskriti: { plannedRemaining: 22, sickRemaining: 4 }
    };

    const normalizeName = (name: string) => name.toLowerCase().replace(/\s+/g, '');
    const usernameKey = (user.username || '').toLowerCase().trim();
    const usernameLocalPart = usernameKey.split('@')[0] || usernameKey;
    const manualBalance =
      manualStartingBalances[usernameKey] ??
      manualStartingBalances[usernameLocalPart] ??
      manualStartingBalances[normalizeName(user.name)] ??
      null;
    const manualEffectiveMs = new Date(MANUAL_BALANCE_EFFECTIVE_DATE).getTime();

    const today = new Date();
    const joiningDate = user.joiningDate ? new Date(user.joiningDate) : today;
    const thisYearAnniversary = new Date(today.getFullYear(), joiningDate.getMonth(), joiningDate.getDate());
    const cycleStartDate = thisYearAnniversary <= today
      ? thisYearAnniversary
      : new Date(today.getFullYear() - 1, joiningDate.getMonth(), joiningDate.getDate());
    const cycleEndDate = new Date(cycleStartDate);
    cycleEndDate.setFullYear(cycleEndDate.getFullYear() + 1);

    const cycleStartMs = new Date(cycleStartDate.getFullYear(), cycleStartDate.getMonth(), cycleStartDate.getDate()).getTime();
    const cycleEndMs = new Date(cycleEndDate.getFullYear(), cycleEndDate.getMonth(), cycleEndDate.getDate()).getTime();
    const monthStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthStartMs = monthStartDate.getTime();
    const monthEndMs = monthEndDate.getTime();

    const approvedLeaveEntries = userLeaves.filter((l) => l.status === 'Approved' && l.type === 'Leave');
    const approvedWfhEntries = userLeaves.filter((l) => l.status === 'Approved' && l.type === 'Work From Home');

    const isInCycle = (dateStr: string, startMs: number, endMs: number) => {
      const d = new Date(dateStr).getTime();
      return d >= startMs && d < endMs;
    };

    const plannedUsedCurrentCycle = approvedLeaveEntries
      .filter((l) => (l.leaveCategory ?? 'Planned') === 'Planned' && isInCycle(l.startDate, cycleStartMs, cycleEndMs))
      .reduce((sum, l) => sum + l.numberOfDays, 0);

    const sickUsedCurrentCycle = approvedLeaveEntries
      .filter((l) => (l.leaveCategory ?? 'Planned') === 'Sick' && isInCycle(l.startDate, cycleStartMs, cycleEndMs))
      .reduce((sum, l) => sum + l.numberOfDays, 0);

    const plannedBasePerCycle = 25;
    const sickBasePerCycle = 5;

    const previousCycleStartDate = new Date(cycleStartDate);
    previousCycleStartDate.setFullYear(previousCycleStartDate.getFullYear() - 1);
    const previousCycleEndDate = new Date(cycleStartDate);
    const previousCycleStartMs = previousCycleStartDate.getTime();
    const previousCycleEndMs = previousCycleEndDate.getTime();

    const plannedUsedPreviousCycle = approvedLeaveEntries
      .filter((l) => (l.leaveCategory ?? 'Planned') === 'Planned' && isInCycle(l.startDate, previousCycleStartMs, previousCycleEndMs))
      .reduce((sum, l) => sum + l.numberOfDays, 0);

    const manualAppliesToCurrentCycle =
      !!manualBalance &&
      manualEffectiveMs >= cycleStartMs &&
      manualEffectiveMs < cycleEndMs;

    const plannedUsedBeforeManualInCurrentCycle = approvedLeaveEntries
      .filter(
        (l) =>
          (l.leaveCategory ?? 'Planned') === 'Planned' &&
          isInCycle(l.startDate, cycleStartMs, cycleEndMs) &&
          new Date(l.startDate).getTime() < manualEffectiveMs,
      )
      .reduce((sum, l) => sum + l.numberOfDays, 0);

    const sickUsedBeforeManualInCurrentCycle = approvedLeaveEntries
      .filter(
        (l) =>
          (l.leaveCategory ?? 'Planned') === 'Sick' &&
          isInCycle(l.startDate, cycleStartMs, cycleEndMs) &&
          new Date(l.startDate).getTime() < manualEffectiveMs,
      )
      .reduce((sum, l) => sum + l.numberOfDays, 0);

    // Carry forward planned leave from previous cycle moving forward.
    const previousCyclePlannedTotal = plannedBasePerCycle;
    const previousCyclePlannedRemaining = Math.max(0, previousCyclePlannedTotal - plannedUsedPreviousCycle);
    const plannedCarryForward = manualAppliesToCurrentCycle ? 0 : previousCyclePlannedRemaining;

    const plannedTotal = manualAppliesToCurrentCycle
      ? (manualBalance!.plannedRemaining + plannedUsedBeforeManualInCurrentCycle)
      : (plannedBasePerCycle + plannedCarryForward);

    const sickTotal = manualAppliesToCurrentCycle
      ? (manualBalance!.sickRemaining + sickUsedBeforeManualInCurrentCycle)
      : sickBasePerCycle;

    const plannedRemaining = Math.max(0, plannedTotal - plannedUsedCurrentCycle);
    const sickRemaining = Math.max(0, sickTotal - sickUsedCurrentCycle);
    const wfhBasePerMonth = 2;
    const wfhUsedCurrentMonth = approvedWfhEntries
      .filter((l) => {
        const d = new Date(l.startDate).getTime();
        return d >= monthStartMs && d < monthEndMs;
      })
      .reduce((sum, l) => sum + l.numberOfDays, 0);
    const wfhRemaining = Math.max(0, wfhBasePerMonth - wfhUsedCurrentMonth);

    return {
      cycleStart: cycleStartDate.toISOString().split('T')[0],
      cycleEnd: cycleEndDate.toISOString().split('T')[0],
      currentMonth: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
      plannedTotal,
      plannedCarryForward,
      plannedUsedCurrentCycle,
      plannedRemaining,
      sickTotal,
      sickUsedCurrentCycle,
      sickRemaining,
      wfhTotal: wfhBasePerMonth,
      wfhUsedCurrentMonth,
      wfhRemaining,
      totalAllowed: plannedTotal + sickTotal + wfhBasePerMonth,
      used: plannedUsedCurrentCycle + sickUsedCurrentCycle + wfhUsedCurrentMonth,
      remaining: plannedRemaining + sickRemaining + wfhRemaining,
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
