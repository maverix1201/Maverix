# Setup Instructions

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   - The `.env.local` file is already configured with your credentials
   - All required environment variables are set

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Access the Application**
   - Open http://localhost:3000
   - Sign up with your email
   - Check your email for verification link
   - Set your password
   - Login and access your dashboard

## First Admin User

To create the first admin user:

1. Sign up with an email address
2. Verify your email and set password
3. In MongoDB, update the user's role to 'admin':
   ```javascript
   db.users.updateOne(
     { email: "your-email@example.com" },
     { $set: { role: "admin" } }
   )
   ```

Alternatively, you can use MongoDB Compass or any MongoDB client to update the role.

## Testing the Application

### Admin Features
- Navigate to `/admin` after logging in as admin
- Manage employees at `/admin/employees`
- Review leave requests at `/admin/leaves`
- Manage finance at `/admin/finance`

### HR Features
- Navigate to `/hr` after logging in as HR
- Approve/reject leaves at `/hr/leaves`
- View attendance at `/hr/attendance`
- View finance reports at `/hr/finance`

### Employee Features
- Navigate to `/employee` after logging in as employee
- Clock in/out from the dashboard
- Apply for leave at `/employee/leaves`
- View attendance at `/employee/attendance`
- View salary slips at `/employee/finance`

## Troubleshooting

### Email Not Sending
- Verify SMTP credentials in `.env.local`
- Check Gmail app password settings
- Ensure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS are correct

### MongoDB Connection Issues
- Verify MONGODB_URI is correct
- Check network connectivity
- Ensure MongoDB Atlas IP whitelist includes your IP

### Authentication Issues
- Clear browser cookies
- Verify NEXTAUTH_SECRET is set
- Check NEXTAUTH_URL matches your application URL

## Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Set environment variables in your hosting platform

3. Start the production server:
   ```bash
   npm start
   ```

## Notes

- All passwords are hashed using bcrypt
- Email verification tokens expire after 24 hours
- Attendance records are created per day
- Leave requests require approval from HR/Admin
- Finance records can only be created by Admin

