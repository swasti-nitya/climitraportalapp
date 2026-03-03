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
        createTableIfMissing: true,
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
      res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
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
    res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
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

  app.get(api.expenses.list.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });

    let expensesList;
    if (user.role === 'Super Admin') {
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
      
      const expense = await storage.createExpense({
        ...input,
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

  app.patch(api.expenses.updateStatus.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'Super Admin') {
      return res.status(403).json({ message: "Unauthorized: Super Admin access required" });
    }

    try {
      const input = api.expenses.updateStatus.input.parse(req.body);
      const expenseId = parseInt(req.params.id, 10);
      
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
        reason: z.string(),
        numberOfDays: z.number().positive(),
      });
      
      const input = bodySchema.parse(req.body);
      
      const leave = await storage.createLeave({
        ...input,
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
      const id = parseInt(req.params.id);
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
    { name: 'Aryaman', email: 'aryaman@climitra.com', role: 'Super Admin' },
    { name: 'Shrinivas', email: 'shrinivas@climitra.com', role: 'User' },
    { name: 'Sanat', email: 'sanat@climitra.com', role: 'User' },
    { name: 'Shubhankar', email: 'shubhankar@climitra.com', role: 'Super Admin' },
    { name: 'Shaurya', email: 'shaurya@climitra.com', role: 'Super Admin' },
    { name: 'Deepam', email: 'deepam@climitra.com', role: 'User' },
    { name: 'Sankalp', email: 'sankalp@climitra.com', role: 'User' },
    { name: 'Nandini', email: 'nandini@climitra.com', role: 'User' },
    { name: 'Aman', email: 'aman@climitra.com', role: 'User' },
    { name: 'Khyati', email: 'khyati@climitra.com', role: 'User' },
    { name: 'Sanskriti', email: 'sanskriti@climitra.com', role: 'User' },
    { name: 'Swasti', email: 'swasti@climitra.com', role: 'User' },
    { name: 'Admin', email: 'admin@climitra.com', role: 'Super Admin' },
  ];

  try {
    const existingUser = await storage.getUserByUsername('admin@climitra.com');
    if (!existingUser) {
      for (const u of usersToSeed) {
        await storage.createUser({
          username: u.email.toLowerCase(),
          password: 'password123', // Default password for everyone
          name: u.name,
          role: u.role,
        });
      }
      console.log('Seeded database with users.');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}
