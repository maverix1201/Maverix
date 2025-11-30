# MM HRM - Human Resources Management System

A modern, minimalistic HR Management web application built with Next.js 14, TypeScript, MongoDB, and NextAuth.

## Features

- **Role-Based Access Control**: Admin, HR, and Employee dashboards
- **Email Verification**: Secure signup with email verification
- **Attendance Management**: Clock in/out functionality with tracking
- **Leave Management**: Apply, approve, and track leave requests
- **Finance Management**: Payroll and salary slip management
- **User Management**: Admin can manage employees (add, edit, delete)
- **Modern UI**: Clean, responsive design with Tailwind CSS and Framer Motion

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Email**: Nodemailer
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ installed
- MongoDB Atlas account (or local MongoDB)
- Gmail account for SMTP (or configure your own SMTP)

### Installation

1. Clone the repository or navigate to the project directory

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - The `.env.local` file is already configured with the provided credentials
   - Make sure all environment variables are set correctly

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/
│   ├── admin/          # Admin dashboard pages
│   ├── hr/             # HR dashboard pages
│   ├── employee/       # Employee dashboard pages
│   ├── api/            # API routes
│   ├── login/          # Login page
│   ├── signup/         # Signup page
│   └── verify/         # Email verification page
├── components/         # Reusable components
├── lib/               # Utility functions
├── models/            # Mongoose models
├── types/             # TypeScript type definitions
├── utils/             # Helper functions
└── middleware.ts      # Route protection middleware
```

## User Roles

### Admin
- Manage employees (add, edit, delete)
- Manage leave requests
- Manage finance/payroll
- Assign roles

### HR
- Approve/deny leave requests
- View and manage attendance
- View finance reports
- View employee information

### Employee
- Clock in/out
- Apply for leave
- View attendance history
- View salary slips

## Authentication Flow

1. User signs up with email and name
2. Verification email is sent
3. User clicks verification link
4. User sets password
5. User can now login

## API Routes

- `/api/auth/signup` - User registration
- `/api/auth/verify` - Email verification and password setup
- `/api/auth/login` - User login (handled by NextAuth)
- `/api/users` - User management (CRUD)
- `/api/attendance` - Attendance tracking
- `/api/leave` - Leave management
- `/api/finance` - Finance/payroll management

## Environment Variables

All environment variables are configured in `.env.local`:

- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DB` - Database name
- `NEXTAUTH_SECRET` - Secret for NextAuth
- `NEXTAUTH_URL` - Application URL
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - Email configuration
- `FROM_EMAIL` - Sender email address

## Building for Production

```bash
npm run build
npm start
```

## License

This project is private and proprietary.

## Support

For issues or questions, please contact the development team.

