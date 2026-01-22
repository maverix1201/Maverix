import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';

const DashboardLayout = dynamic(() => import('@/components/DashboardLayout'), {
  ssr: false,
});
import Feed from '@/components/Feed';

export default async function HRFeedPage() {
  const session = await getServerSession(authOptions);

  if (!session || ((session.user as any).role !== 'hr' && (session.user as any).role !== 'admin')) {
    redirect('/login');
  }

  return (
    <DashboardLayout role="hr">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="space-y-6 p-4 md:p-6">
          <Feed />
        </div>
      </div>
    </DashboardLayout>
  );
}

