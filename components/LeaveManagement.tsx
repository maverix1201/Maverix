'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Check, X, Calendar, Clock, Search, Filter, XCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import RejectLeaveModal from './RejectLeaveModal';
import UserAvatar from './UserAvatar';
import Pagination from './Pagination';

interface Leave {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
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
  const [showFilters, setShowFilters] = useState(false);
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

      let data;
      try {
        data = await res.json();
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
            leave._id === id ? { ...leave, ...data.leave, status: 'approved' as const } : leave
          )
        );
      }
      toast.success('Leave request approved successfully');
      
      // Dispatch custom event to refresh "on leave" badges immediately
      // Add small delay to ensure database update is complete
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('leaveStatusChanged'));
      }, 100);
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

      let data;
      try {
        data = await res.json();
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
            leave._id === id ? { ...leave, ...data.leave, status: 'rejected' as const } : leave
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
    return leaves.filter((leave) => {
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

      // Date range filter
      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom);
        const leaveStartDate = new Date(leave.startDate);
        if (leaveStartDate < fromDate) return false;
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999); // Include the entire end date
        const leaveEndDate = new Date(leave.endDate);
        if (leaveEndDate > toDate) return false;
      }

      return true;
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

  const hasActiveFilters = filterStatus !== 'all' || filterEmployee !== 'all' || filterLeaveType !== 'all' || filterDateFrom || filterDateTo || searchTerm;

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
      {/* Search and Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by employee name, email, or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
            />
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors font-secondary ${
              showFilters || hasActiveFilters
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="bg-white text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {[
                  filterStatus !== 'all',
                  filterEmployee !== 'all',
                  filterLeaveType !== 'all',
                  filterDateFrom,
                  filterDateTo,
                ].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-secondary"
            >
              <XCircle className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3"
          >
            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Employee Filter */}
            {canApprove && employees.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">Employee</label>
                <select
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                >
                  <option value="all">All Employees</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Leave Type Filter */}
            {leaveTypes.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">Leave Type</label>
                <select
                  value={filterLeaveType}
                  onChange={(e) => setFilterLeaveType(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                >
                  <option value="all">All Types</option>
                  {leaveTypes.map((type) => (
                    <option key={type._id} value={type._id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date From Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">From Date</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
              />
            </div>

            {/* Date To Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">To Date</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600 font-secondary">
        Showing {filteredLeaves.length} of {leaves.length} leave requests
      </div>

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
                  <td colSpan={canApprove ? 7 : 5} className="px-4 py-8 text-center text-gray-500 font-secondary">
                    {hasActiveFilters ? 'No leave requests match your filters' : 'No leave requests found'}
                  </td>
                </tr>
              ) : (
                paginatedLeaves.map((leave) => (
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
                          image={(leave.userId as any)?.profileImage}
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
                      {format(new Date(leave.startDate), 'MMM dd, yyyy')} -{' '}
                      {format(new Date(leave.endDate), 'MMM dd, yyyy')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 max-w-xs truncate font-secondary">{leave.reason}</div>
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
                ))
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
                <span className="font-semibold">Days:</span> {rejectModal.leave.days || 'N/A'}
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
                <span className="font-semibold">Days:</span> {deleteModal.leave.days || 'N/A'}
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
    </div>
  );
}

