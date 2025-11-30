'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Calendar, User, Clock, Edit, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';

interface Leave {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  leaveType: {
    _id: string;
    name: string;
    description?: string;
  };
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  allottedBy?: {
    _id: string;
    name: string;
  };
  carryForward?: boolean;
}

interface AllottedLeavesListProps {
  leaves: Leave[];
  employees: any[];
  onRefresh?: () => void;
  onEditEmployee?: (employeeId: string, employeeLeaves: Leave[]) => void;
}

export default function AllottedLeavesList({ leaves, employees, onRefresh, onEditEmployee }: AllottedLeavesListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; leave: Leave | null }>({
    isOpen: false,
    leave: null,
  });
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  // Filter allotted leaves (only leaves that were allotted)
  const allottedLeaves = useMemo(() => {
    return leaves.filter((leave) => leave.allottedBy);
  }, [leaves]);

  // Group leaves by employee
  const groupedLeaves = useMemo(() => {
    const grouped: { [key: string]: Leave[] } = {};
    allottedLeaves.forEach((leave) => {
      const userId = leave.userId?._id || '';
      if (!grouped[userId]) {
        grouped[userId] = [];
      }
      grouped[userId].push(leave);
    });
    return grouped;
  }, [allottedLeaves]);

  // Apply search and filters
  const filteredGroupedLeaves = useMemo(() => {
    const filtered: { [key: string]: Leave[] } = {};
    
    Object.keys(groupedLeaves).forEach((userId) => {
      const employeeLeaves = groupedLeaves[userId];
      const firstLeave = employeeLeaves[0];
      const employee = employees.find((e) => e._id === userId);
      
      const matchesSearch =
        !searchTerm ||
        employee?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employeeLeaves.some((leave) =>
        (typeof leave.leaveType === 'object' ? leave.leaveType?.name : leave.leaveType)
          ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
        );

      const matchesEmployee = !filterEmployee || userId === filterEmployee;
      const matchesStatus =
        filterStatus === 'all' ||
        employeeLeaves.some((leave) => leave.status === filterStatus);

      if (matchesSearch && matchesEmployee && matchesStatus) {
        filtered[userId] = employeeLeaves;
      }
    });

    return filtered;
  }, [groupedLeaves, searchTerm, filterEmployee, filterStatus, employees]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const handleDeleteClick = (leave: Leave) => {
    setDeleteModal({ isOpen: true, leave });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.leave) return;

    const id = deleteModal.leave._id;
    setDeleting(true);

    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete leave');
        setDeleting(false);
        setDeleteModal({ isOpen: false, leave: null });
        return;
      }

      toast.success('Leave deleted successfully');
      setDeleting(false);
      setDeleteModal({ isOpen: false, leave: null });
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      toast.error('An error occurred');
      setDeleting(false);
      setDeleteModal({ isOpen: false, leave: null });
    }
  };

  const handleEditEmployee = (userId: string) => {
    const employeeLeaves = filteredGroupedLeaves[userId] || [];
    if (onEditEmployee) {
      onEditEmployee(userId, employeeLeaves);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-primary font-semibold text-gray-800 mb-4">Allotted Leaves</h2>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by employee or leave type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white appearance-none"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
          >
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Grouped Leaves List */}
      <div className="p-4 space-y-3">
        {Object.keys(filteredGroupedLeaves).length === 0 ? (
          <div className="text-center py-12 text-gray-500 font-secondary">
                  No allotted leaves found
          </div>
            ) : (
          Object.keys(filteredGroupedLeaves).map((userId) => {
            const employeeLeaves = filteredGroupedLeaves[userId];
            const firstLeave = employeeLeaves[0];
            const employee = employees.find((e) => e._id === userId) || firstLeave.userId;

            return (
              <motion.div
                key={userId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-gray-200 rounded-lg p-3 hover:border-primary/50 transition-colors"
                >
                {/* Employee Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                      <UserAvatar
                      name={employee?.name || firstLeave.userId?.name}
                      image={(employee as any)?.profileImage || (firstLeave.userId as any)?.profileImage}
                        size="md"
                      />
                      <div>
                      <div className="text-sm font-semibold text-gray-900 font-primary">
                        {employee?.name || firstLeave.userId?.name || 'N/A'}
                        </div>
                      <div className="text-xs text-gray-500 font-secondary">
                        {employee?.email || firstLeave.userId?.email || 'N/A'}
                      </div>
                    </div>
                    </div>
                  <button
                    onClick={() => handleEditEmployee(userId)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-secondary"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </button>
                    </div>

                {/* Leave Types Grid */}
                <div className="flex flex-wrap gap-2">
                  {employeeLeaves.map((leave) => (
                    <motion.div
                      key={leave._id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group relative bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-200 hover:border-primary/30 transition-colors flex items-center gap-2"
                    >
                      <span className="text-xs font-medium text-gray-800 capitalize font-secondary">
                        {typeof leave.leaveType === 'object' ? leave.leaveType?.name : leave.leaveType}
                      </span>
                      <span className="text-xs font-semibold text-primary font-primary">
                        {leave.days || 'N/A'} {leave.days === 1 ? 'day' : 'days'}
                    </span>
                      <button
                        onClick={() => handleDeleteClick(leave)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-red-600 hover:bg-red-50 rounded transition-all"
                        title="Delete"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
              </div>
              </motion.div>
            );
          })
        )}
              </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, leave: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Allotted Leave"
        message="Are you sure you want to delete this allotted leave?"
        details={
          deleteModal.leave ? (
            <div className="space-y-1">
              <div>
                <span className="font-semibold">Employee:</span>{' '}
                {deleteModal.leave.userId?.name || 'N/A'} ({deleteModal.leave.userId?.email || 'N/A'})
              </div>
              <div>
                <span className="font-semibold">Leave Type:</span>{' '}
                {typeof deleteModal.leave.leaveType === 'object'
                  ? deleteModal.leave.leaveType?.name
                  : deleteModal.leave.leaveType}
              </div>
              <div>
                <span className="font-semibold">Days:</span> {deleteModal.leave.days || 'N/A'}
              </div>
              <div>
                <span className="font-semibold">Dates:</span>{' '}
                {format(new Date(deleteModal.leave.startDate), 'MMM dd, yyyy')} -{' '}
                {format(new Date(deleteModal.leave.endDate), 'MMM dd, yyyy')}
              </div>
            </div>
          ) : null
        }
        loading={deleting}
      />
    </div>
  );
}
