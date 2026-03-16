import { z } from 'zod';
import { insertExpenseSchema, insertLeaveSchema, insertHolidaySchema, expenses, users } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

// We create a combined schema for expenses that includes the user
const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
  role: z.string(),
  joiningDate: z.string().nullable(),
});

const expenseWithUserSchema = z.object({
  id: z.number(),
  userId: z.number(),
  date: z.string(),
  amount: z.string(),
  paidTo: z.string(),
  category: z.string(),
  description: z.string(),
  remarks: z.string().nullable(),
  paymentProofUrl: z.string().nullable(),
  invoiceUrl: z.string().nullable(),
  status: z.string(),
  isFlagged: z.boolean(),
  flagReason: z.string().nullable(),
  mealParticipantCount: z.number(),
  mealParticipants: z.string().nullable(),
  stayParticipantCount: z.number(),
  stayCheckIn: z.string().nullable(),
  stayCheckOut: z.string().nullable(),
  createdAt: z.string().nullable(),
  user: userSchema.optional()
});

const leaveWithUserSchema = z.object({
  id: z.number(),
  userId: z.number(),
  startDate: z.string(),
  endDate: z.string(),
  type: z.string(),
  leaveCategory: z.string().nullable(),
  reason: z.string(),
  numberOfDays: z.number(),
  status: z.string(),
  approvedBy: z.number().nullable(),
  approvalRemark: z.string().nullable(),
  createdAt: z.string().nullable(),
  user: userSchema.optional()
});


export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/login' as const,
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: userSchema,
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout' as const,
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/me' as const,
      responses: {
        200: userSchema,
        401: errorSchemas.unauthorized,
      },
    },
    changePassword: {
      method: 'PUT' as const,
      path: '/api/change-password' as const,
      input: z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(6, 'Password must be at least 6 characters'),
      }),
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    users: {
      method: 'GET' as const,
      path: '/api/users' as const,
      responses: {
        200: z.array(userSchema),
        401: errorSchemas.unauthorized,
      },
    },
  },
  expenses: {
    list: {
      method: 'GET' as const,
      path: '/api/expenses' as const,
      responses: {
        200: z.array(expenseWithUserSchema),
        401: errorSchemas.unauthorized,
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/expenses' as const,
      input: insertExpenseSchema,
      responses: {
        201: expenseWithUserSchema,
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/expenses/:id' as const,
      input: insertExpenseSchema,
      responses: {
        200: expenseWithUserSchema,
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        403: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      }
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/expenses/:id/status' as const,
      input: z.object({ status: z.enum(['Pending', 'Approved', 'Rejected', 'Paid']) }),
      responses: {
        200: expenseWithUserSchema,
        403: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      }
    }
  },
  uploads: {
    create: {
      method: 'POST' as const,
      path: '/api/upload' as const,
      input: z.object({ filename: z.string(), content: z.string() }),
      responses: {
        200: z.object({ url: z.string() }),
      }
    }
  },
  ocr: {
    extractAmount: {
      method: 'POST' as const,
      path: '/api/ocr/extract-amount' as const,
      input: z.object({ filename: z.string(), content: z.string() }),
      responses: {
        200: z.object({
          amount: z.number().nullable(),
          confidence: z.enum(['high', 'medium', 'low']).optional(),
        }),
        401: errorSchemas.unauthorized,
        503: errorSchemas.internal,
      },
    },
  },
  leaves: {
    list: {
      method: 'GET' as const,
      path: '/api/leaves' as const,
      responses: {
        200: z.array(leaveWithUserSchema),
        401: errorSchemas.unauthorized,
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/leaves' as const,
      input: insertLeaveSchema.extend({
        leaveCategory: z.enum(['Planned', 'Sick']).optional(),
      }),
      responses: {
        201: leaveWithUserSchema,
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/leaves/:id/status' as const,
      input: z.object({ 
        status: z.enum(['Approved', 'Rejected']),
        approvalRemark: z.string().optional()
      }),
      responses: {
        200: leaveWithUserSchema,
        403: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      }
    },
    count: {
      method: 'GET' as const,
      path: '/api/leaves/:userId/count' as const,
      responses: {
        200: z.object({
          cycleStart: z.string(),
          cycleEnd: z.string(),
          currentMonth: z.string(),
          plannedTotal: z.number(),
          plannedCarryForward: z.number(),
          plannedUsedCurrentCycle: z.number(),
          plannedRemaining: z.number(),
          sickTotal: z.number(),
          sickUsedCurrentCycle: z.number(),
          sickRemaining: z.number(),
          wfhTotal: z.number(),
          wfhUsedCurrentMonth: z.number(),
          wfhRemaining: z.number(),
          totalAllowed: z.number(),
          used: z.number(),
          remaining: z.number(),
        }),
        401: errorSchemas.unauthorized,
        403: errorSchemas.unauthorized,
      }
    }
  },
  holidays: {
    list: {
      method: 'GET' as const,
      path: '/api/holidays' as const,
      responses: {
        200: z.array(z.object({
          id: z.number(),
          date: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          createdAt: z.string().nullable(),
        })),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/holidays' as const,
      input: insertHolidaySchema,
      responses: {
        201: z.object({
          id: z.number(),
          date: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          createdAt: z.string().nullable(),
        }),
        400: errorSchemas.validation,
        403: errorSchemas.unauthorized,
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/holidays/:id' as const,
      responses: {
        200: z.object({ message: z.string() }),
        403: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
