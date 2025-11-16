'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import EmployeeLeaveView from '@/components/EmployeeLeaveView';
import LoadingDots from '@/components/LoadingDots';

export default function EmployeeLeavesPage() {
  const { data: session } = useSession();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      const res = await fetch('/api/leave');
      const data = await res.json();
      setLeaves(data.leaves || []);
    } catch (err) {
      console.error('Error fetching leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="employee">
      <div className="space-y-4">

        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center">
            <LoadingDots size="lg" className="mb-3" />
            <p className="text-sm text-gray-500 font-secondary">Loading leave information...</p>
          </div>
        ) : (
          <EmployeeLeaveView initialLeaves={leaves} onLeavesUpdated={fetchLeaves} />
        )}
      </div>
    </DashboardLayout>
  );
}

