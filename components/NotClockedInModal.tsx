'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, Users } from 'lucide-react';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';

interface Employee {
  _id: string;
  name: string;
  email: string;
  profileImage?: string;
  designation?: string;
}

interface NotClockedInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotClockedInModal({ isOpen, onClose }: NotClockedInModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchNotClockedInEmployees();
    }
  }, [isOpen]);

  const fetchNotClockedInEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/not-clocked-in-today');
      const data = await res.json();
      
      if (res.ok) {
        setEmployees(data.employees || []);
      } else {
        setError(data.error || 'Failed to fetch employees');
      }
    } catch (err) {
      console.error('Error fetching not clocked in employees:', err);
      setError('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-purple-100 rounded-lg">
                <Clock className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-primary font-bold text-gray-800">
                  Not Clocked In Today
                </h2>
                <p className="text-xs text-gray-600 font-secondary">
                  {loading ? 'Loading...' : `${employees.length} employee${employees.length !== 1 ? 's' : ''} not clocked in`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <LoadingDots size="md" className="mb-3" />
                <p className="text-sm text-gray-600 font-secondary">Loading employees...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="p-3 bg-red-100 rounded-full mb-3">
                  <X className="w-6 h-6 text-red-600" />
                </div>
                <p className="text-sm text-red-600 font-secondary">{error}</p>
                <button
                  onClick={fetchNotClockedInEmployees}
                  className="mt-3 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-secondary"
                >
                  Retry
                </button>
              </div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="p-3 bg-green-100 rounded-full mb-3">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-gray-600 font-secondary text-base font-semibold">
                  All employees have clocked in today!
                </p>
                <p className="text-gray-500 font-secondary text-xs mt-1">
                  Great job! Everyone is present.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {employees.map((employee, index) => (
                  <motion.div
                    key={employee._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                  >
                    <UserAvatar
                      name={employee.name}
                      image={employee.profileImage || undefined}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-primary font-semibold text-gray-800 truncate">
                        {employee.name}
                      </h3>
                      <p className="text-xs text-gray-600 font-secondary truncate">
                        {employee.email}
                      </p>
                      {employee.designation && (
                        <p className="text-xs text-gray-500 font-secondary mt-0.5">
                          {employee.designation}
                        </p>
                      )}
                    </div>
                    <div className="px-2 py-0.5 bg-red-100 rounded-full flex-shrink-0">
                      <span className="text-xs font-semibold text-red-600 font-secondary">
                        Not In
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-secondary font-semibold text-sm"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

