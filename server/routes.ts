import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import fs from "fs";
import path from "path";
import express from "express";

const SessionStore = MemoryStore(session);

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session setup
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'secret123',
      resave: false,
      saveUninitialized: false,
      store: new SessionStore({ checkPeriod: 86400000 }),
      cookie: { maxAge: 86400000 },
    })
  );

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'client', 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

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
