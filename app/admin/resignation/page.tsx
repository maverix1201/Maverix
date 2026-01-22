import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import connectDB from '@/lib/mongodb';
import Resignation from '@/models/Resignation';
import ResignationManagement from '@/components/ResignationManagement';

const DashboardLayout = dynamic(() => import('@/components/DashboardLayout'), {
  ssr: false,
});

export default async function AdminResignationPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== 'admin') {
    redirect('/login');
  }

  await connectDB();
  const resignations = await Resignation.find({})
    .populate('userId', 'name email profileImage empId designation')
    .populate('approvedBy', 'name email')
    .select('userId resignationDate reason feedback assets noticePeriodStartDate noticePeriodEndDate noticePeriodComplied clearances handoverNotes knowledgeTransferCompleted assetsReturned exitInterviewCompleted fnfStatus exitDocuments systemAccessDeactivated exitClosed status approvedBy approvedAt rejectionReason createdAt updatedAt')
    .sort({ createdAt: -1 })
    .lean();

  return (
    <DashboardLayout role="admin">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-primary font-bold text-gray-800">Resignation Management</h1>
            <p className="text-xs text-gray-600 mt-0.5 font-secondary">
              Review and manage employee resignation requests
            </p>
          </div>
        </div>

        <ResignationManagement initialResignations={JSON.parse(JSON.stringify(resignations))} />
      </div>
    </DashboardLayout>
  );
}
