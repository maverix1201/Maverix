import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';

const DashboardLayout = dynamic(() => import('@/components/DashboardLayout'), {
  ssr: false,
});
import connectDB from '@/lib/mongodb';
import Finance from '@/models/Finance';
import User from '@/models/User';
import FinanceManagement from '@/components/FinanceManagement';

export default async function AdminFinancePage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== 'admin') {
    redirect('/login');
  }

  await connectDB();
  const finances = await Finance.find()
    .populate('userId', 'name email profileImage bankName accountNumber ifscCode location panNumber aadharNumber')
    .sort({ year: -1, month: -1 })
    .lean();

  return (
    <DashboardLayout role="admin">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="space-y-6 p-4 md:p-6">
          <FinanceManagement
            initialFinances={JSON.parse(JSON.stringify(finances))}
            canEdit={true}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

