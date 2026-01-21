'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { UserCheck, CheckCircle, X, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';

interface PendingEmployee {
  _id: string;
  name: string;
  email: string;
  role: string;
  designation?: string;
  profileImage?: string;
  emailVerified: boolean;
  createdAt: string;
}

export default function PendingEmployees() {
  const [employees, setEmployees] = useState<PendingEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const toast = useToast();

  const fetchPendingEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees/pending');
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.employees || []);
      } else {
        toast.error(data.error || 'Failed to fetch pending employees');
      }
    } catch (err: any) {
      console.error('Error fetching pending employees:', err);
      toast.error('Failed to load pending employees');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPendingEmployees();
    // Refresh periodically (keep modest to reduce load)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchPendingEmployees();
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPendingEmployees();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchPendingEmployees]);

  const handleApprove = async (employeeId: string) => {
    setApproving(employeeId);
    try {
      const res = await fetch(`/api/employees/${employeeId}/approve`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Employee ${data.employee.name} approved successfully!`);
        // Remove the approved employee from the list immediately
        setEmployees((prev) => prev.filter((emp) => emp._id !== employeeId));
        // Also refresh the list to ensure consistency
        fetchPendingEmployees();
      } else {
        toast.error(data.error || 'Failed to approve employee');
      }
    } catch (err: any) {
      console.error('Error approving employee:', err);
      toast.error('Failed to approve employee');
    } finally {
      setApproving(null);
    }
  };

  return (
    <div className="bg-white rounded-md border border-gray-100 shadow-lg h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0 p-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-yellow-100 rounded-md">
            <Clock className="w-3.5 h-3.5 text-yellow-600" />
          </div>
          <div>
            <h2 className="text-sm font-primary font-bold text-gray-900">Pending Approvals</h2>
            <p className="text-[9px] text-gray-500 font-secondary mt-0.5">
              {employees.length} {employees.length === 1 ? 'employee' : 'employees'} waiting for approval
            </p>
          </div>
        </div>
        {employees.length > 0 && (
          <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold font-secondary">
            {employees.length}
          </span>
        )}
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingDots size="lg" className="mb-2" />
            <p className="text-sm text-gray-500 font-secondary mt-2">Loading...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="p-4 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-base font-primary font-semibold text-gray-600 mb-1">No pending approvals</p>
            <p className="text-sm text-gray-500 font-secondary">All employees have been approved</p>
          </div>
        ) : (
          <div className="space-y-3">
            {employees.map((employee, index) => (
              <motion.div
                key={employee._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group bg-gradient-to-br from-white to-yellow-50/30 rounded-xl border border-gray-200 hover:border-yellow-400 hover:shadow-lg transition-all duration-200 p-4 relative overflow-hidden"
              >
                {/* Decorative gradient bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400"></div>
                
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative">
                      <UserAvatar
                        name={employee.name}
                        image={employee.profileImage}
                        size="sm"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-500 border-2 border-white rounded-full animate-pulse"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-primary font-bold text-gray-800 truncate">
                          {employee.name}
                        </h3>
                        {employee.designation && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-700 font-secondary border border-orange-200">
                            {employee.designation}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 font-secondary truncate mb-1.5">
                        {employee.email}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-gray-500 font-secondary">
                          <Clock className="w-3 h-3" />
                          <span>Registered {format(new Date(employee.createdAt), 'MMM dd, yyyy')}</span>
                        </div>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs text-gray-500 font-secondary">
                          {formatDistanceToNow(new Date(employee.createdAt), { addSuffix: true })}
                        </span>
                        {!employee.emailVerified && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-xs text-orange-600 font-semibold font-secondary">
                              Email not verified
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleApprove(employee._id)}
                    disabled={approving === employee._id}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all font-secondary font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap border border-green-600/20"
                  >
                    {approving === employee._id ? (
                      <>
                        <LoadingDots size="sm" />
                        <span>Approving...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Approve</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

