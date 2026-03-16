import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import fs from "fs";
import path from "path";
import express from "express";
import { pool } from "./db";

const PgSession = connectPgSimple(session);

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    app.set('trust proxy', 1);
  }

  // Ensure session table exists (avoids connect-pg-simple reading table.sql from bundled dist)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      sid varchar NOT NULL COLLATE "default" PRIMARY KEY,
      sess json NOT NULL,
      expire timestamp(6) NOT NULL
    )
  `);

  await pool.query(
    `CREATE INDEX IF NOT EXISTS IDX_user_sessions_expire ON user_sessions (expire)`
  );

  // Session setup
  app.use(
    session({
      name: 'climitra.sid',
      secret: process.env.SESSION_SECRET || 'secret123',
      resave: false,
      saveUninitialized: false,
      proxy: isProduction,
      store: new PgSession({
        pool,
        tableName: 'user_sessions',
      }),
      cookie: {
        maxAge: 86400000,
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
      },
    })
  );

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve uploaded files
  app.use('/uploads', express.static(uploadsDir));

  // Routes

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(input.username.toLowerCase());
      
      if (!user || user.password !== input.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      res.json({ id: user.id, username: user.username, name: user.name, role: user.role, joiningDate: user.joiningDate ?? null });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy((err) => {
      res.json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json({ id: user.id, username: user.username, name: user.name, role: user.role, joiningDate: user.joiningDate ?? null });
  });

  app.put(api.auth.changePassword.path, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const input = api.auth.changePassword.input.parse(req.body);
      const user = await storage.getUser(req.session.userId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.password !== input.currentPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      await storage.updateUserPassword(req.session.userId, input.newPassword);
      
      res.json({ message: "Password updated successfully" });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  app.get(api.auth.users.path, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const users = await storage.getUsers();
    res.json(users.map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      joiningDate: user.joiningDate ?? null,
    })));
  });

  app.get(api.expenses.list.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });

    let expensesList;
    if (user.role === 'Super Admin' || user.role === 'CA') {
      expensesList = await storage.getExpenses();
    } else {
      expensesList = await storage.getExpensesByUserId(user.id);
    }
    res.json(expensesList);
  });

  app.post(api.expenses.create.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const bodySchema = api.expenses.create.input.extend({
        amount: z.string() // We accept string or convert
      });
      const input = bodySchema.parse(req.body);

      // --- Cap flagging logic ---
      let isFlagged = false;
      const flagReasons: string[] = [];
      const submittedFlagReason = input.flagReason?.trim() || null;
      const cat = input.category;
      const amt = parseFloat(String(input.amount));

      if (cat === 'Meals - Travel related') {
        const existing = await storage.getExpensesByUserId(req.session.userId as number);
        const participantCount = Math.max(1, input.mealParticipantCount ?? 1);
        const dayTotal = existing
          .filter(e => e.date === input.date && e.category === 'Meals - Travel related' && e.status !== 'Rejected')
          .reduce((s, e) => s + parseFloat(String(e.amount)), 0);
        if (dayTotal + amt > 1000 * participantCount) {
          isFlagged = true;
          flagReasons.push(
            participantCount > 1
              ? `Multiple people included — cumulative same-day meal total exceeds the ₹${(1000 * participantCount).toLocaleString('en-IN')} cap for ${participantCount} people.`
              : 'Cumulative same-day meal total exceeds the ₹1,000 per person/day cap.'
          );
        }
      } else if (cat === 'Stay') {
        const ci = input.stayCheckIn as string | null | undefined;
        const co = input.stayCheckOut as string | null | undefined;
        const stayPeople = Math.max(1, input.stayParticipantCount ?? 1);
        if (ci && co) {
          const nights = Math.max(1, Math.ceil((new Date(co).getTime() - new Date(ci).getTime()) / 86400000));
          const stayCap = 3000 * nights * stayPeople;
          if (amt > stayCap) {
            isFlagged = true;
            flagReasons.push(`Stay amount exceeds the ₹${stayCap.toLocaleString('en-IN')} cap (₹3,000 × ${nights} night${nights > 1 ? 's' : ''} × ${stayPeople} person${stayPeople > 1 ? 's' : ''}).`);
          }
        } else if (amt > 3000 * stayPeople) {
          isFlagged = true;
          flagReasons.push(`Stay amount exceeds the ₹${(3000 * stayPeople).toLocaleString('en-IN')} per-night cap for ${stayPeople} person${stayPeople > 1 ? 's' : ''}.`);
        }
      } else if (cat.startsWith('Operational')) {
        const existing = await storage.getExpensesByUserId(req.session.userId as number);
        const ref = new Date(input.date);
        const dow = ref.getDay();
        const mon = new Date(ref);
        mon.setDate(ref.getDate() - (dow === 0 ? 6 : dow - 1));
        mon.setHours(0, 0, 0, 0);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        sun.setHours(23, 59, 59, 999);
        const wkTotal = existing
          .filter(e => {
            const d = new Date(e.date);
            return e.category.startsWith('Operational') && e.status !== 'Rejected' && d >= mon && d <= sun;
          })
          .reduce((s, e) => s + parseFloat(String(e.amount)), 0);
        if (wkTotal + amt > 50000) {
          isFlagged = true;
          flagReasons.push('Operational expenses exceed the ₹50,000 weekly cap.');
        }
      }

      if (submittedFlagReason) {
        isFlagged = true;
        flagReasons.push(submittedFlagReason);
      }

      const flagReason = flagReasons.length > 0 ? flagReasons.join(' | ') : null;

      if (!isFlagged && input.paymentProofUrl === null && input.invoiceUrl === null) {
        // keep null when nothing is flagged
      }
      // --- end flagging ---

      const expense = await storage.createExpense({
        ...input,
        isFlagged,
        flagReason,
        userId: req.session.userId,
      });
      
      res.status(201).json(expense);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Error creating expense:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.expenses.update.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

    try {
      const expenseId = parseInt(req.params.id, 10);
      const existingExpense = await storage.getExpenseById(expenseId);

      if (!existingExpense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      if (existingExpense.userId !== req.session.userId) {
        return res.status(403).json({ message: "You can only edit your own expenses" });
      }

      if (existingExpense.status !== 'Pending') {
        return res.status(403).json({ message: "Only pending expenses can be edited" });
      }

      const bodySchema = api.expenses.update.input.extend({
        amount: z.string(),
      });
      const input = bodySchema.parse(req.body);

      // Recompute cap flagging on edit as amount/category/date may change
      let isFlagged = false;
      const flagReasons: string[] = [];
      const submittedFlagReason = input.flagReason?.trim() || null;
      const cat = input.category;
      const amt = parseFloat(String(input.amount));
      const otherExpenses = (await storage.getExpensesByUserId(req.session.userId)).filter((e) => e.id !== expenseId);

      if (cat === 'Meals - Travel related') {
        const participantCount = Math.max(1, input.mealParticipantCount ?? 1);
        const dayTotal = otherExpenses
          .filter(e => e.date === input.date && e.category === 'Meals - Travel related' && e.status !== 'Rejected')
          .reduce((s, e) => s + parseFloat(String(e.amount)), 0);
        if (dayTotal + amt > 1000 * participantCount) {
          isFlagged = true;
          flagReasons.push(
            participantCount > 1
              ? `Multiple people included — cumulative same-day meal total exceeds the ₹${(1000 * participantCount).toLocaleString('en-IN')} cap for ${participantCount} people.`
              : 'Cumulative same-day meal total exceeds the ₹1,000 per person/day cap.'
          );
        }
      } else if (cat === 'Stay') {
        const ci = input.stayCheckIn as string | null | undefined;
        const co = input.stayCheckOut as string | null | undefined;
        const stayPeople = Math.max(1, input.stayParticipantCount ?? 1);
        if (ci && co) {
          const nights = Math.max(1, Math.ceil((new Date(co).getTime() - new Date(ci).getTime()) / 86400000));
          const stayCap = 3000 * nights * stayPeople;
          if (amt > stayCap) {
            isFlagged = true;
            flagReasons.push(`Stay amount exceeds the ₹${stayCap.toLocaleString('en-IN')} cap (₹3,000 × ${nights} night${nights > 1 ? 's' : ''} × ${stayPeople} person${stayPeople > 1 ? 's' : ''}).`);
          }
        } else if (amt > 3000 * stayPeople) {
          isFlagged = true;
          flagReasons.push(`Stay amount exceeds the ₹${(3000 * stayPeople).toLocaleString('en-IN')} per-night cap for ${stayPeople} person${stayPeople > 1 ? 's' : ''}.`);
        }
      } else if (cat.startsWith('Operational')) {
        const ref = new Date(input.date);
        const dow = ref.getDay();
        const mon = new Date(ref);
        mon.setDate(ref.getDate() - (dow === 0 ? 6 : dow - 1));
        mon.setHours(0, 0, 0, 0);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        sun.setHours(23, 59, 59, 999);
        const wkTotal = otherExpenses
          .filter(e => {
            const d = new Date(e.date);
            return e.category.startsWith('Operational') && e.status !== 'Rejected' && d >= mon && d <= sun;
          })
          .reduce((s, e) => s + parseFloat(String(e.amount)), 0);
        if (wkTotal + amt > 50000) {
          isFlagged = true;
          flagReasons.push('Operational expenses exceed the ₹50,000 weekly cap.');
        }
      }

      if (submittedFlagReason) {
        isFlagged = true;
        flagReasons.push(submittedFlagReason);
      }

      const flagReason = flagReasons.length > 0 ? flagReasons.join(' | ') : null;

      const updated = await storage.updateExpense(expenseId, {
        ...input,
        isFlagged,
        flagReason,
      });

      if (!updated) {
        return res.status(404).json({ message: "Expense not found" });
      }

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Error updating expense:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.expenses.updateStatus.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    
    const user = await storage.getUser(req.session.userId);

    try {
      const input = api.expenses.updateStatus.input.parse(req.body);
      const expenseId = parseInt(req.params.id, 10);
      const existingExpense = await storage.getExpenseById(expenseId);

      if (!user) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      if (!existingExpense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      const isSuperAdmin = user.role === 'Super Admin';
      const isCa = user.role === 'CA';

      if (isSuperAdmin) {
        if (!['Approved', 'Rejected'].includes(input.status)) {
          return res.status(403).json({ message: "Super Admin can only approve or reject expenses" });
        }
      } else if (isCa) {
        if (input.status !== 'Paid') {
          return res.status(403).json({ message: "CA can only mark expenses as paid" });
        }
        if (existingExpense.status !== 'Approved') {
          return res.status(403).json({ message: "Only approved expenses can be marked as paid" });
        }
      } else {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updated = await storage.updateExpenseStatus(expenseId, input.status);
      if (!updated) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.uploads.create.path, express.json({ limit: '50mb' }), async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const input = api.uploads.create.input.parse(req.body);
      const { filename, content } = input;
      
      // content is a base64 string like: data:image/png;base64,iVBOR...
      const matches = content.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ message: "Invalid base64 string" });
      }
      
      const ext = path.extname(filename);
      const safeFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
      const buffer = Buffer.from(matches[2], 'base64');
      
      const filePath = path.join(uploadsDir, safeFilename);
      fs.writeFileSync(filePath, buffer);
      
      res.json({ url: `/uploads/${safeFilename}` });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      console.error("Upload error:", err);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.post(api.ocr.extractAmount.path, express.json({ limit: '20mb' }), async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

    try {
      const input = api.ocr.extractAmount.input.parse(req.body);
      const matches = input.content.match(/^data:([A-Za-z0-9/+.-]+);base64,(.+)$/);

      if (!matches || matches.length !== 3) {
        return res.status(400).json({ message: "Invalid file payload" });
      }

      // Placeholder: replace with real key in environment later
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "PASTE_GEMINI_API_KEY_HERE";
      const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      if (!process.env.GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_GEMINI_API_KEY_HERE") {
        return res.status(503).json({ message: "Gemini OCR is not configured. Set GEMINI_API_KEY in environment." });
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const prompt = [
        "You are extracting receipt totals for reimbursements.",
        "Return ONLY valid JSON (no markdown):",
        '{"amount": number|null, "confidence": "high"|"medium"|"low"}',
        "Rules:",
        "1) amount must be the final payable total on the receipt/invoice.",
        "2) Ignore item lines, taxes, discounts unless they are the final amount.",
        "3) If unreadable or uncertain, set amount to null.",
      ].join("\n");

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error('Gemini OCR error:', errorText);
        let upstreamMessage = 'Gemini OCR request failed';
        try {
          const parsedError = JSON.parse(errorText);
          upstreamMessage = parsedError?.error?.message || upstreamMessage;
        } catch {
          // keep default message when upstream body is not JSON
        }

        return res.status(geminiResponse.status).json({
          message: upstreamMessage,
        });
      }

      const payload: any = await geminiResponse.json();
      const text = payload?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';

      const cleaned = text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      let amount: number | null = null;
      let confidence: 'high' | 'medium' | 'low' | undefined;

      try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed?.amount === 'number' && Number.isFinite(parsed.amount) && parsed.amount > 0) {
          amount = parsed.amount;
        }
        if (parsed?.confidence === 'high' || parsed?.confidence === 'medium' || parsed?.confidence === 'low') {
          confidence = parsed.confidence;
        }
      } catch {
        const fallback = cleaned.match(/([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/);
        if (fallback?.[1]) {
          const parsedAmount = Number.parseFloat(fallback[1].replace(/,/g, ''));
          if (!Number.isNaN(parsedAmount) && parsedAmount > 0) {
            amount = parsedAmount;
          }
        }
      }

      return res.json({ amount, confidence });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid OCR input" });
      }
      console.error('OCR route error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Leave Management Routes
  app.get(api.leaves.list.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });

    let leavesList;
    if (user.role === 'Super Admin') {
      leavesList = await storage.getLeaves();
    } else {
      leavesList = await storage.getLeavesByUserId(user.id);
    }
    res.json(leavesList);
  });

  app.get(api.leaves.count.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const userId = parseInt(req.params.userId, 10);
      
      // Check authorization
      const currentUser = await storage.getUser(req.session.userId);
      if (currentUser?.role !== 'Super Admin' && currentUser?.id !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const leaveCount = await storage.getLeaveCount(userId);
      res.json(leaveCount);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.leaves.create.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const bodySchema = z.object({
        startDate: z.string(),
        endDate: z.string(),
        type: z.enum(['Leave', 'Work From Home']),
        leaveCategory: z.enum(['Planned', 'Sick']).optional(),
        reason: z.string(),
        numberOfDays: z.number().positive(),
      });
      
      const input = bodySchema.parse(req.body);

      const normalizedCategory = input.type === 'Leave' ? (input.leaveCategory ?? 'Planned') : null;
      const initialStatus =
        (input.type === 'Leave' && normalizedCategory === 'Sick') || input.type === 'Work From Home'
          ? 'Approved'
          : 'Pending';

      if (input.type === 'Work From Home' || (input.type === 'Leave' && normalizedCategory === 'Sick')) {
        const leaveCount = await storage.getLeaveCount(req.session.userId);

        if (input.type === 'Work From Home') {
          if (leaveCount.wfhRemaining <= 0) {
            return res.status(400).json({
              message: 'wfh exhausted',
            });
          }

          if (input.numberOfDays > leaveCount.wfhRemaining) {
            return res.status(400).json({
              message: `Only ${leaveCount.wfhRemaining} Work From Home day${leaveCount.wfhRemaining !== 1 ? 's' : ''} remaining this month.`,
            });
          }
        }

        if (input.type === 'Leave' && normalizedCategory === 'Sick') {
          if (leaveCount.sickRemaining <= 0) {
            return res.status(400).json({
              message: 'sick leave exhausted',
            });
          }

          if (input.numberOfDays > leaveCount.sickRemaining) {
            return res.status(400).json({
              message: `Only ${leaveCount.sickRemaining} sick leave day${leaveCount.sickRemaining !== 1 ? 's' : ''} remaining in this cycle.`,
            });
          }
        }
      }

      const leave = await storage.createLeave({
        ...input,
        leaveCategory: normalizedCategory,
        status: initialStatus,
        approvedBy: initialStatus === 'Approved' ? req.session.userId : null,
        approvalRemark: initialStatus === 'Approved'
          ? (input.type === 'Work From Home' ? 'Auto-approved work from home' : 'Auto-approved sick leave')
          : null,
        userId: req.session.userId,
      });
      
      res.status(201).json(leave);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Error creating leave:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.leaves.updateStatus.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'Super Admin') {
      return res.status(403).json({ message: "Unauthorized: Super Admin access required" });
    }

    try {
      const bodySchema = z.object({
        status: z.enum(['Approved', 'Rejected']),
        approvalRemark: z.string().optional(),
      });
      
      const input = bodySchema.parse(req.body);
      const leaveId = parseInt(req.params.id, 10);
      
      const updated = await storage.updateLeaveStatus(
        leaveId,
        input.status,
        req.session.userId,
        input.approvalRemark
      );
      
      if (!updated) {
        return res.status(404).json({ message: "Leave not found" });
      }
      
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Holiday routes
  app.get(api.holidays.list.path, async (req, res) => {
    const holidays = await storage.getHolidays();
    res.json(holidays);
  });

  app.post(api.holidays.create.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'Super Admin') {
      return res.status(403).json({ message: "Only Super Admin can add holidays" });
    }

    try {
      const input = api.holidays.create.input.parse(req.body);
      const holiday = await storage.createHoliday(input);
      res.status(201).json(holiday);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete(api.holidays.delete.path.replace(':id', ':id'), async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'Super Admin') {
      return res.status(403).json({ message: "Only Super Admin can delete holidays" });
    }

    try {
      const id = parseInt(String(req.params.id), 10);
      await storage.deleteHoliday(id);
      res.json({ message: "Holiday deleted" });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const usersToSeed = [
    { name: 'Aryaman', email: 'aryaman@climitra.com', role: 'Super Admin', joiningDate: '2025-02-22' },
    { name: 'Shrinivas', email: 'shrinivas@climitra.com', role: 'User', joiningDate: '2026-01-19' },
    { name: 'Sanat', email: 'sanat@climitra.com', role: 'User', joiningDate: '2025-08-01' },
    { name: 'Shubhankar', email: 'shubhankar@climitra.com', role: 'Super Admin', joiningDate: '2025-02-22' },
    { name: 'Shaurya', email: 'shaurya@climitra.com', role: 'Super Admin', joiningDate: '2025-02-22' },
    { name: 'Deepam', email: 'deepam@climitra.com', role: 'User' },
    { name: 'Sankalp', email: 'sankalp@climitra.com', role: 'User' },
    { name: 'Nandini', email: 'nandini@climitra.com', role: 'User', joiningDate: '2025-07-01' },
    { name: 'Aman', email: 'aman@climitra.com', role: 'User', joiningDate: '2025-07-01' },
    { name: 'Khyati', email: 'khyati@climitra.com', role: 'User', joiningDate: '2025-10-01' },
    { name: 'Sanskriti', email: 'sanskriti@climitra.com', role: 'User', joiningDate: '2025-11-07' },
    { name: 'Pranav', email: 'pranav@climitra.com', role: 'User', joiningDate: '2025-12-01' },
    { name: 'Swasti', email: 'swasti@climitra.com', role: 'User', joiningDate: '2025-01-02' },
    { name: 'Ayush', email: 'ayush@wydespectrum.com', role: 'CA' },
    { name: 'Admin', email: 'admin@climitra.com', role: 'Super Admin' },
  ];

  try {
    for (const u of usersToSeed) {
      const existingUser = await storage.getUserByUsername(u.email.toLowerCase());
      if (!existingUser) {
        await storage.createUser({
          username: u.email.toLowerCase(),
          password: 'password123',
          name: u.name,
          role: u.role,
          joiningDate: u.joiningDate ?? null,
        });
      } else if (u.joiningDate && existingUser.joiningDate !== u.joiningDate) {
        await pool.query(
          `UPDATE users SET joining_date = $1 WHERE id = $2`,
          [u.joiningDate, existingUser.id]
        );
      }
    }
    console.log('Verified database users seed.');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}
