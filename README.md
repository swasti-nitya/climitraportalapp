# Expense & Leave Tracker

A full-stack expense and leave management system with admin approval workflows.

## Features

- **Expense Management**: Submit, track, and approve expenses with file uploads
- **Leave Management**: Apply for leaves/WFH, track balance (30 days/year)
- **Holiday Calendar**: Super admins can declare company holidays
- **Admin Dashboard**: Approve/reject expenses and leaves with remarks
- **Profile Management**: Users can change their passwords
- **Role-based Access**: Regular users and Super Admin roles

## Tech Stack

- **Frontend**: React, Vite, TailwindCSS, Wouter, TanStack Query
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Session-based authentication

## Local Development

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd Expense-Approverzip
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up PostgreSQL**
```bash
docker-compose up -d
```

4. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

5. **Push database schema**
```bash
npm run db:push
```

6. **Start development server**
```bash
npm run dev
```

Visit `http://localhost:5000`

## Default Credentials

After first run, the system seeds with default users:
- **Admin**: admin@company.com / password123
- **User**: john@company.com / password123

## Deployment to Railway

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Railway will auto-detect your Node.js app

### Step 3: Add PostgreSQL Database

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway automatically creates a `DATABASE_URL` environment variable

### Step 4: Set Environment Variables

Railway auto-injects `DATABASE_URL`, but you need to add:

- `SESSION_SECRET`: A random secret string (e.g., generate with `openssl rand -base64 32`)
- `NODE_ENV`: Set to `production`

### Step 5: Run Database Migrations

After deployment, run migrations from Railway's deployment logs or use:

```bash
npm run db:migrate
```

The seed data will be automatically created on first server start.

### Step 6: Access Your App

Railway will provide a public URL (e.g., `your-app.up.railway.app`)

## Project Structure

```
├── client/               # Frontend React app
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # React Query hooks
│   │   ├── pages/       # Route pages
│   │   └── lib/         # Utilities
│   └── public/uploads/  # File uploads
├── server/              # Backend Express server
│   ├── db.ts           # Database connection
│   ├── routes.ts       # API routes
│   └── storage.ts      # Data access layer
├── shared/             # Shared types & schemas
│   ├── schema.ts       # Database schema (Drizzle)
│   └── routes.ts       # API route definitions
└── railway.json        # Railway configuration

```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Secret for session encryption | `random-secret-string` |
| `NODE_ENV` | Environment mode | `development` or `production` |

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations

## License

MIT
