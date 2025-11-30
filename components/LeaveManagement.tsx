'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Check, X, Calendar, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import RejectLeaveModal from './RejectLeaveModal';
import UserAvatar from './UserAvatar';
import Pagination from './Pagination';
import AdvancedFilterBar from './AdvancedFilterBar';

// Helper function to convert 24-hour time to 12-hour format
const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const min = minutes || '00';
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${min} ${period}`;
};

// Helper function to format time range from "HH:MM-HH:MM" to "h:mm AM - h:mm PM"
const formatTimeRange = (timeRange: string): string => {
  if (!timeRange) return '';
  if (timeRange.includes('-')) {
    const [from, to] = timeRange.split('-');
    return `${formatTime12Hour(from)} - ${formatTime12Hour(to)}`;
  }
  return formatTime12Hour(timeRange);
};

interface Leave {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
  };
  leaveType: string | {
    _id: string;
    name: string;
    description?: string;
  };
  days?: number;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  halfDayType?: 'first-half' | 'second-half';
  shortDayTime?: string;
  createdAt: string;
  allottedBy?: {
    _id: string;
    name: string;
  };
}

interface Employee {
  _id: string;
  name: string;
  email: string;
}

interface LeaveType {
  _id: string;
  name: string;
  description?: string;
}

interface LeaveManagementProps {
  initialLeaves: Leave[];
  canApprove: boolean;
  onLeaveAdded?: () => void;
  employees?: Employee[];
  leaveTypes?: LeaveType[];
}

export default function LeaveManagement({
  initialLeaves,
  canApprove,
  onLeaveAdded,
  employees = [],
  leaveTypes = [],
}: LeaveManagementProps) {
  const [leaves, setLeaves] = useState(initialLeaves);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    leaveType: 'vacation' as 'sick' | 'vacation' | 'personal' | 'emergency',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterLeaveType, setFilterLeaveType] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; leave: Leave | null }>({
    isOpen: false,
    leave: null,
  });
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; leave: Leave | null }>({
    isOpen: false,
    leave: null,
  });
  const [rejecting, setRejecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reasonModal, setReasonModal] = useState<{ isOpen: boolean; reason: string }>({
    isOpen: false,
    reason: '',
  });

  // Update leaves when initialLeaves changes
  useEffect(() => {
    setLeaves(initialLeaves);
  }, [initialLeaves]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'An error occurred');
        setLoading(false);
        return;
      }

      setLeaves([data.leave, ...leaves]);
      setShowModal(false);
      setFormData({ leaveType: 'vacation', startDate: '', endDate: '', reason: '' });
      toast.success('Leave request submitted successfully');
      if (onLeaveAdded) onLeaveAdded();
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    // Optimistic update - update immediately in UI
    const previousLeaves = [...leaves];
    setLeaves(
      leaves.map((leave) =>
        leave._id === id ? { ...leave, status: 'approved' as const } : leave
      )
    );

    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      let data: { error?: string; leave?: Leave };
      try {
        data = await res.json() as { error?: string; leave?: Leave };
      } catch (parseError) {
        // Revert on error
        setLeaves(previousLeaves);
        toast.error('Failed to parse server response');
        return;
      }

      if (!res.ok) {
        // Revert on error
        setLeaves(previousLeaves);
        toast.error(data.error || 'Failed to approve leave request');
        return;
      }

      // Update with the response data to ensure consistency
      if (data.leave) {
        setLeaves(
          leaves.map((leave) =>
            leave._id === id ? { ...leave, ...data.leave!, status: 'approved' as const } : leave
          )
        );
      }
      toast.success('Leave request approved successfully');
      
      // Dispatch custom event to refresh "on leave" badges immediately
      // Add small delay to ensure database update is complete
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('leaveStatusChanged'));
      }, 100);
      
      // Refresh the list if callback is provided
      if (onLeaveAdded) {
        onLeaveAdded();
      }
    } catch (err: any) {
      // Revert on error
      setLeaves(previousLeaves);
      toast.error(err.message || 'An error occurred while approving leave request');
    }
  };

  const handleRejectClick = (leave: Leave) => {
    setRejectModal({ isOpen: true, leave });
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectModal.leave) return;

    const id = rejectModal.leave._id;
    const isApprovedLeave = rejectModal.leave.status === 'approved';
    setRejecting(true);

    // Optimistic update - update immediately in UI
    const previousLeaves = [...leaves];
    setLeaves(
      leaves.map((leave) =>
        leave._id === id ? { ...leave, status: 'rejected' as const } : leave
      )
    );

    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejectionReason: reason }),
      });

      let data: { error?: string; leave?: Leave };
      try {
        data = await res.json() as { error?: string; leave?: Leave };
      } catch (parseError) {
        // Revert on error
        setLeaves(previousLeaves);
        toast.error('Failed to parse server response');
        setRejecting(false);
        setRejectModal({ isOpen: false, leave: null });
        return;
      }

      if (!res.ok) {
        // Revert on error
        setLeaves(previousLeaves);
        toast.error(data.error || 'Failed to reject leave request');
        setRejecting(false);
        setRejectModal({ isOpen: false, leave: null });
        return;
      }

      // Update with the response data to ensure consistency
      if (data.leave) {
        setLeaves(
          leaves.map((leave) =>
            leave._id === id ? { ...leave, ...data.leave!, status: 'rejected' as const } : leave
          )
        );
      }
      
      const successMessage = isApprovedLeave
        ? 'Leave rejected successfully. Leave balance has been restored to the employee.'
        : 'Leave request rejected successfully';
      toast.success(successMessage);
      
      // Dispatch custom event to refresh "on leave" badges immediately
      // Add small delay to ensure database update is complete
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('leaveStatusChanged'));
      }, 100);
      
      if (onLeaveAdded) onLeaveAdded();
      setRejecting(false);
      setRejectModal({ isOpen: false, leave: null });
    } catch (err: any) {
      // Revert on error
      setLeaves(previousLeaves);
      toast.error(err.message || 'An error occurred while rejecting leave request');
      setRejecting(false);
      setRejectModal({ isOpen: false, leave: null });
    }
  };

  const handleDeleteClick = (leave: Leave) => {
    setDeleteModal({ isOpen: true, leave });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.leave) return;

    const id = deleteModal.leave._id;
    setDeleting(true);

    // Optimistic update - remove immediately from UI
    const previousLeaves = [...leaves];
    setLeaves(leaves.filter((leave) => leave._id !== id));
    toast.success('Leave request deleted successfully');

    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        // Revert on error
        setLeaves(previousLeaves);
        toast.error('Failed to delete leave request');
        setDeleting(false);
        setDeleteModal({ isOpen: false, leave: null });
        return;
      }

      // Refresh the list if callback is provided
      if (onLeaveAdded) {
        onLeaveAdded();
      }
      setDeleting(false);
      setDeleteModal({ isOpen: false, leave: null });
    } catch (err) {
      // Revert on error
      setLeaves(previousLeaves);
      toast.error('An error occurred');
      setDeleting(false);
      setDeleteModal({ isOpen: false, leave: null });
    }
  };

  // Filter and search logic
  const filteredLeaves = useMemo(() => {
    const filtered = leaves.filter((leave) => {
      // Search filter - search in employee name, email, reason
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          leave.userId?.name?.toLowerCase().includes(searchLower) ||
          leave.userId?.email?.toLowerCase().includes(searchLower) ||
          leave.reason?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filterStatus !== 'all' && leave.status !== filterStatus) {
        return false;
      }

      // Employee filter
      if (filterEmployee !== 'all' && leave.userId?._id !== filterEmployee) {
        return false;
      }

      // Leave type filter
      if (filterLeaveType !== 'all') {
        const leaveTypeId = typeof leave.leaveType === 'object' ? leave.leaveType?._id : leave.leaveType;
        if (leaveTypeId !== filterLeaveType) {
          return false;
        }
      }

      // Date range filter - filter by "Requested On" date (createdAt)
      if (filterDateFrom || filterDateTo) {
        if (!leave.createdAt) return false;
        
        const requestedDate = new Date(leave.createdAt);
        requestedDate.setHours(0, 0, 0, 0);
        
        // If only from date is set, treat it as a single date filter
        if (filterDateFrom && !filterDateTo) {
          const filterDate = new Date(filterDateFrom);
          filterDate.setHours(0, 0, 0, 0);
          const filterDateEnd = new Date(filterDateFrom);
          filterDateEnd.setHours(23, 59, 59, 999);
          
          // Check if requested date falls within the filter date
          if (requestedDate < filterDate || requestedDate > filterDateEnd) {
            return false;
          }
        }
        // If only to date is set, treat it as a single date filter
        else if (!filterDateFrom && filterDateTo) {
          const filterDate = new Date(filterDateTo);
          filterDate.setHours(0, 0, 0, 0);
          const filterDateEnd = new Date(filterDateTo);
          filterDateEnd.setHours(23, 59, 59, 999);
          
          // Check if requested date falls within the filter date
          if (requestedDate < filterDate || requestedDate > filterDateEnd) {
            return false;
          }
        }
        // If both dates are set, check if requested date is within the range
        else if (filterDateFrom && filterDateTo) {
          const fromDate = new Date(filterDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          const toDate = new Date(filterDateTo);
          toDate.setHours(23, 59, 59, 999);
          
          // Check if requested date falls within the filter date range
          if (requestedDate < fromDate || requestedDate > toDate) {
            return false;
          }
        }
      }

      return true;
    });

    // Sort by start date (newest first) to group dates together
    return filtered.sort((a, b) => {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      return dateB - dateA;
    });
  }, [leaves, searchTerm, filterStatus, filterEmployee, filterLeaveType, filterDateFrom, filterDateTo]);

  // Pagination logic
  const paginatedLeaves = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredLeaves.slice(startIndex, endIndex);
  }, [filteredLeaves, currentPage]);

  const totalPages = Math.ceil(filteredLeaves.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterEmployee, filterLeaveType, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterEmployee('all');
    setFilterLeaveType('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasActiveFilters = !!(
    filterStatus !== 'all' ||
    filterEmployee !== 'all' ||
    filterLeaveType !== 'all' ||
    filterDateFrom ||
    filterDateTo ||
    searchTerm
  );

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

  return (
    <div className="space-y-4">
      {/* Advanced Filter Bar */}
      <AdvancedFilterBar
        searchPlaceholder="Search by employee name, email, or reason..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        hasActiveFilters={hasActiveFilters}
        onClearAll={clearFilters}
        resultsCount={filteredLeaves.length}
        totalCount={leaves.length}
        filters={[
          {
            label: 'Status',
            key: 'status',
            type: 'select' as const,
            value: filterStatus,
            onChange: (value: string) => setFilterStatus(value as 'all' | 'pending' | 'approved' | 'rejected'),
            options: [
              { value: 'all', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ],
          },
          ...(canApprove && employees.length > 0
            ? [
                {
                  label: 'Employee',
                  key: 'employee',
                  type: 'select' as const,
                  value: filterEmployee,
                  onChange: setFilterEmployee,
                  options: [
                    { value: 'all', label: 'All Employees' },
                    ...employees.map((emp) => ({ value: emp._id, label: emp.name })),
                  ],
                },
              ]
            : []),
          ...(leaveTypes.length > 0
            ? [
                {
                  label: 'Leave Type',
                  key: 'leaveType',
                  type: 'select' as const,
                  value: filterLeaveType,
                  onChange: setFilterLeaveType,
                  options: [
                    { value: 'all', label: 'All Types' },
                    ...leaveTypes.map((type) => ({ value: type._id, label: type.name })),
                  ],
                },
              ]
            : []),
          {
            label: 'Date Range',
            key: 'date',
            type: 'dateRange' as const,
            value: '',
            onChange: () => {},
          },
          {
            label: 'From Date',
            key: 'dateFrom',
            type: 'date' as const,
            value: filterDateFrom,
            onChange: setFilterDateFrom,
          },
          {
            label: 'To Date',
            key: 'dateTo',
            type: 'date' as const,
            value: filterDateTo,
            onChange: setFilterDateTo,
          },
        ]}
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {canApprove && (
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                    Employee
                  </th>
                )}
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                  Type
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                  Days
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                  Dates
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                  Reason
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                  Requested On
                </th>
                {canApprove && (
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedLeaves.length === 0 ? (
                <tr>
                  <td colSpan={canApprove ? 8 : 6} className="px-4 py-8 text-center text-gray-500 font-secondary">
                    {hasActiveFilters ? 'No leave requests match your filters' : 'No leave requests found'}
                  </td>
                </tr>
              ) : (
                paginatedLeaves.map((leave, index) => {
                  // Check if this is the first row or if the date has changed
                  const prevLeave = index > 0 ? paginatedLeaves[index - 1] : null;
                  const currentDate = new Date(leave.startDate).toDateString();
                  const prevDate = prevLeave ? new Date(prevLeave.startDate).toDateString() : null;
                  const shouldShowSeparator = prevDate && currentDate !== prevDate;

                  return (
                    <>
                      {shouldShowSeparator && (
                        <tr key={`separator-${leave._id}`}>
                          <td
                            colSpan={canApprove ? 8 : 6}
                            className="px-4 py-2 bg-gray-50 border-t-2 border-gray-300"
                          >
                            <div className="text-sm font-semibold text-gray-700 font-secondary">
                              {format(new Date(leave.startDate), 'MMM dd, yyyy')}
                            </div>
                          </td>
                        </tr>
                      )}
                      <motion.tr
                        key={leave._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-gray-50"
                      >
                  {canApprove && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={leave.userId?.name}
                          image={leave.userId?.profileImage}
                          size="md"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 font-secondary">
                            {leave.userId?.name || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500 font-secondary">{leave.userId?.email || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize font-secondary">
                      {typeof leave.leaveType === 'object' ? leave.leaveType?.name : leave.leaveType}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-secondary">
                      {leave.days === 0.5 ? '0.5 day' : 
                       leave.days && leave.days < 1 && leave.days > 0 ? `${leave.days.toFixed(2)} day` : 
                       `${leave.days || 'N/A'} ${leave.days === 1 ? 'day' : 'days'}`}
                      {leave.halfDayType && (
                        <span className="ml-2 text-xs text-purple-600 font-medium">
                          ({leave.halfDayType === 'first-half' ? 'First Half' : 'Second Half'})
                        </span>
                      )}
                      {leave.shortDayTime && (
                        <span className="ml-2 text-xs text-blue-600 font-medium">
                          ({formatTimeRange(leave.shortDayTime)})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-secondary">
                      {format(new Date(leave.startDate), 'MMM dd, yyyy')} -{' '}
                      {format(new Date(leave.endDate), 'MMM dd, yyyy')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setReasonModal({ isOpen: true, reason: leave.reason || 'No reason provided' })}
                      className="text-sm text-primary hover:text-primary-dark underline font-secondary cursor-pointer"
                    >
                      Click to view
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full font-secondary ${getStatusColor(
                        leave.status
                      )}`}
                    >
                      {leave.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-secondary">
                      {leave.createdAt ? format(new Date(leave.createdAt), 'MMM dd, yyyy') : 'N/A'}
                    </div>
                  </td>
                  {canApprove && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {leave.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(leave._id)}
                              className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRejectClick(leave)}
                              className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                              title="Reject"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {leave.status === 'approved' && (
                          <button
                            onClick={() => handleRejectClick(leave)}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                            title="Reject Approved Leave (Balance will be restored)"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteClick(leave)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                      </motion.tr>
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredLeaves.length}
            itemsPerPage={itemsPerPage}
          />
        )}
      </div>

      {/* Reject Leave Modal */}
      <RejectLeaveModal
        isOpen={rejectModal.isOpen}
        onClose={() => setRejectModal({ isOpen: false, leave: null })}
        onConfirm={handleRejectConfirm}
        title={rejectModal.leave?.status === 'approved' ? 'Reject Approved Leave' : 'Reject Leave Request'}
        message={
          rejectModal.leave?.status === 'approved'
            ? 'Are you sure you want to reject this approved leave? The leave days will be restored to the employee\'s balance.'
            : 'Are you sure you want to reject this leave request?'
        }
        details={
          rejectModal.leave ? (
            <div className="space-y-1">
              <div>
                <span className="font-semibold">Employee:</span>{' '}
                {rejectModal.leave.userId?.name || 'N/A'} ({rejectModal.leave.userId?.email || 'N/A'})
              </div>
              <div>
                <span className="font-semibold">Leave Type:</span>{' '}
                {typeof rejectModal.leave.leaveType === 'object'
                  ? rejectModal.leave.leaveType?.name
                  : rejectModal.leave.leaveType}
              </div>
              <div>
                <span className="font-semibold">Dates:</span>{' '}
                {format(new Date(rejectModal.leave.startDate), 'MMM dd, yyyy')} -{' '}
                {format(new Date(rejectModal.leave.endDate), 'MMM dd, yyyy')}
              </div>
              <div>
                <span className="font-semibold">Days:</span>{' '}
                {rejectModal.leave.days === 0.5 && rejectModal.leave.halfDayType
                  ? rejectModal.leave.halfDayType === 'first-half' ? 'First Half' : 'Second Half'
                  : rejectModal.leave.days && rejectModal.leave.days < 1 && rejectModal.leave.days > 0 && rejectModal.leave.shortDayTime
                  ? `Short Day (${formatTimeRange(rejectModal.leave.shortDayTime)}) - ${rejectModal.leave.days.toFixed(2)} day`
                  : `${rejectModal.leave.days || 'N/A'} ${rejectModal.leave.days === 1 ? 'day' : 'days'}`
                }
              </div>
              {rejectModal.leave.reason && (
                <div>
                  <span className="font-semibold">Reason:</span> {rejectModal.leave.reason}
                </div>
              )}
            </div>
          ) : null
        }
        loading={rejecting}
        isApprovedLeave={rejectModal.leave?.status === 'approved'}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, leave: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Leave Request"
        message="Are you sure you want to delete this leave request?"
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
                <span className="font-semibold">Dates:</span>{' '}
                {format(new Date(deleteModal.leave.startDate), 'MMM dd, yyyy')} -{' '}
                {format(new Date(deleteModal.leave.endDate), 'MMM dd, yyyy')}
              </div>
              <div>
                <span className="font-semibold">Days:</span>{' '}
                {deleteModal.leave.days === 0.5 && deleteModal.leave.halfDayType
                  ? deleteModal.leave.halfDayType === 'first-half' ? 'First Half' : 'Second Half'
                  : deleteModal.leave.days && deleteModal.leave.days < 1 && deleteModal.leave.days > 0 && deleteModal.leave.shortDayTime
                  ? `Short Day (${formatTimeRange(deleteModal.leave.shortDayTime)}) - ${deleteModal.leave.days.toFixed(2)} day`
                  : `${deleteModal.leave.days || 'N/A'} ${deleteModal.leave.days === 1 ? 'day' : 'days'}`
                }
              </div>
              <div>
                <span className="font-semibold">Reason:</span> {deleteModal.leave.reason}
              </div>
              <div>
                <span className="font-semibold">Status:</span> {deleteModal.leave.status}
              </div>
            </div>
          ) : null
        }
        loading={deleting}
      />

      {/* Reason View Modal */}
      {reasonModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-primary font-bold text-gray-800">Leave Reason</h2>
              <button
                onClick={() => setReasonModal({ isOpen: false, reason: '' })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-700 font-secondary whitespace-pre-wrap break-words">
                {reasonModal.reason}
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setReasonModal({ isOpen: false, reason: '' })}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-secondary"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

