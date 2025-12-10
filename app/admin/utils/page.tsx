'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Trash2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminUtilsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; deletedCount?: number; totalRecordsBefore?: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteAllAttendance = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/attendance/delete-all', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: `Successfully deleted ${data.deletedCount} attendance records`,
          deletedCount: data.deletedCount,
          totalRecordsBefore: data.totalRecordsBefore,
        });
        setConfirmDelete(false);
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to delete attendance records',
        });
        setConfirmDelete(false);
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'An error occurred while deleting attendance records',
      });
      setConfirmDelete(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 font-primary">Admin Utilities</h1>

          {/* Delete All Attendance Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/95 backdrop-blur-xl rounded-md shadow-lg border border-red-200 p-6 mb-6"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-800 mb-2 font-primary">
                  Delete All Attendance Records
                </h2>
                <p className="text-gray-600 mb-4 font-secondary">
                  This will permanently delete ALL attendance records for all users. This action cannot be undone.
                </p>

                {!confirmDelete ? (
                  <button
                    onClick={handleDeleteAllAttendance}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold font-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Deleting...' : 'Delete All Attendance'}
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-red-800 font-semibold mb-1">⚠️ Final Confirmation Required</p>
                        <p className="text-red-700 text-sm">
                          You are about to permanently delete ALL attendance records. This action cannot be undone.
                          Are you absolutely sure you want to proceed?
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDeleteAllAttendance}
                        disabled={loading}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold font-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Deleting...' : 'Yes, Delete All'}
                      </button>
                      <button
                        onClick={() => {
                          setConfirmDelete(false);
                          setResult(null);
                        }}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold font-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
                      result.success
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p
                        className={`font-semibold mb-1 ${
                          result.success ? 'text-green-800' : 'text-red-800'
                        }`}
                      >
                        {result.success ? 'Success!' : 'Error'}
                      </p>
                      <p
                        className={`text-sm ${
                          result.success ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {result.message}
                        {result.success && result.deletedCount !== undefined && (
                          <span className="block mt-1">
                            Deleted {result.deletedCount} record{result.deletedCount !== 1 ? 's' : ''} out of{' '}
                            {result.totalRecordsBefore} total record{result.totalRecordsBefore !== 1 ? 's' : ''}.
                          </span>
                        )}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

