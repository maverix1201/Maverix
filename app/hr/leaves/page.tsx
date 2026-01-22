import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import connectDB from '@/lib/mongodb';
import Leave from '@/models/Leave';
import LeaveType from '@/models/LeaveType';
import LeaveManagementTabs from '@/components/LeaveManagementTabs';
import LoadingDots from '@/components/LoadingDots';

const DashboardLayout = dynamic(() => import('@/components/DashboardLayout'), {
  ssr: false,
});

export default async function HRLeavesPage() {
  const session = await getServerSession(authOptions);

  if (!session || ((session.user as any).role !== 'hr' && (session.user as any).role !== 'admin')) {
    redirect('/login');
  }

  await connectDB();
  
  // Ensure LeaveType model is registered before populating
  const _ = LeaveType; // Reference to ensure LeaveType is loaded
  
  // Fetch all leaves (including allotted leaves) - same as admin page
  // This ensures HR can see all allotted leaves in the "Allot Leave" tab
  const leaves = await Leave.find()
    .populate('userId', 'name email profileImage')
    .populate('leaveType', 'name description')
    .populate('allottedBy', 'name email profileImage')
    .sort({ createdAt: -1 })
    .lean();

  return (
    <DashboardLayout role="hr">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-primary font-bold text-gray-800">Leave Management</h1>
          <p className="text-sm text-gray-600 mt-0.5 font-secondary">Manage leave requests, types, and allotments</p>
        </div>

        <Suspense fallback={
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center">
            <LoadingDots size="lg" className="mb-3" />
            <p className="text-sm text-gray-500 font-secondary">Loading leave management...</p>
          </div>
        }>
          <LeaveManagementTabs
            initialLeaves={JSON.parse(JSON.stringify(leaves))}
            role="hr"
          />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}

