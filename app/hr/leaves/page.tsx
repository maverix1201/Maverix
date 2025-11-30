import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import connectDB from '@/lib/mongodb';
import Leave from '@/models/Leave';
import LeaveType from '@/models/LeaveType';
import LeaveManagementTabs from '@/components/LeaveManagementTabs';

export default async function HRLeavesPage() {
  const session = await getServerSession(authOptions);

  if (!session || ((session.user as any).role !== 'hr' && (session.user as any).role !== 'admin')) {
    redirect('/login');
  }

  await connectDB();
  
  // Ensure LeaveType model is registered before populating
  const _ = LeaveType; // Reference to ensure LeaveType is loaded
  
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

        <LeaveManagementTabs
          initialLeaves={JSON.parse(JSON.stringify(leaves))}
          role="hr"
        />
      </div>
    </DashboardLayout>
  );
}

