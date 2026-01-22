import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const DashboardLayout = dynamic(() => import('@/components/DashboardLayout'), {
  ssr: false,
});
import connectDB from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import User from '@/models/User';
import AttendanceManagement from '@/components/AttendanceManagement';
import LoadingDots from '@/components/LoadingDots';

export default async function HRAttendancePage() {
  const session = await getServerSession(authOptions);

  if (!session || ((session.user as any).role !== 'hr' && (session.user as any).role !== 'admin')) {
    redirect('/login');
  }

  await connectDB();
  const attendance = await Attendance.find()
    .populate('userId', 'name email profileImage')
    .sort({ date: -1 })
    .limit(100)
    .lean();

  return (
    <DashboardLayout role="hr">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-primary font-bold text-gray-800">Attendance Management</h1>
          <p className="text-sm text-gray-600 mt-0.5 font-secondary">View and manage employee attendance</p>
        </div>

        <Suspense fallback={
          <div className="bg-white/95 backdrop-blur-xl rounded-md shadow-lg border border-white/50 p-12 flex flex-col items-center justify-center">
            <LoadingDots size="lg" className="mb-3" />
            <p className="text-sm text-gray-500 font-secondary">Loading attendance data...</p>
          </div>
        }>
          <AttendanceManagement initialAttendance={JSON.parse(JSON.stringify(attendance))} isAdminOrHR={true} />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}

