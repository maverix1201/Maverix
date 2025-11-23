import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import Profile from '@/components/Profile';

export default async function EmployeeProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== 'employee') {
    redirect('/login');
  }

  return (
    <DashboardLayout role="employee">
      <div className="p-2 md:p-6">
        <Profile />
      </div>
    </DashboardLayout>
  );
}

