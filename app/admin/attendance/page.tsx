import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import connectDB from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import AttendanceManagement from '@/components/AttendanceManagement';

export default async function AdminAttendancePage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== 'admin') {
    redirect('/login');
  }

  await connectDB();
  const attendance = await Attendance.find()
    .populate('userId', 'name email profileImage')
    .sort({ date: -1 })
    .limit(100)
    .lean();

  return (
    <DashboardLayout role="admin">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-primary font-bold text-gray-800">Attendance Management</h1>
          <p className="text-sm text-gray-600 mt-0.5 font-secondary">View and manage employee attendance</p>
        </div>

        <AttendanceManagement initialAttendance={JSON.parse(JSON.stringify(attendance))} />
      </div>
    </DashboardLayout>
  );
}

