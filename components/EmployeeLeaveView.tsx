'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, Clock, User, CheckCircle, X, Trash2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import CircleProgress from './CircleProgress';
import LoadingDots from './LoadingDots';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import Pagination from './Pagination';
import UserAvatar from './UserAvatar';

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
  startDate: string;
  endDate: string;
  days?: number;
  remainingDays?: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  halfDayType?: 'first-half' | 'second-half';
  shortDayTime?: string;
  allottedBy?: {
    _id: string;
    name: string;
  };
  carryForward?: boolean;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

interface EmployeeLeaveViewProps {
  initialLeaves: Leave[];
  onLeavesUpdated?: () => void;
}

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

export default function EmployeeLeaveView({ initialLeaves, onLeavesUpdated }: EmployeeLeaveViewProps) {
  const [leaves, setLeaves] = useState(initialLeaves);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    halfDayType: '' as '' | 'first-half' | 'second-half',
    shortDayFromTime: '',
    shortDayToTime: '',
  });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; leave: Leave | null }>({
    isOpen: false,
    leave: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [teamMembersOnLeave, setTeamMembersOnLeave] = useState<any[]>([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchAllottedLeaveTypes();
  }, []);

  useEffect(() => {
    setLeaves(initialLeaves);
  }, [initialLeaves]);

  // Fetch team members on leave when dates are selected
  useEffect(() => {
    const fetchTeamMembersOnLeave = async () => {
      if (!formData.startDate || !formData.endDate) {
        setTeamMembersOnLeave([]);
        return;
      }

      try {
        setLoadingTeamMembers(true);
        const res = await fetch(
          `/api/leave/team-members-on-leave?startDate=${formData.startDate}&endDate=${formData.endDate}`
        );
        const data = await res.json();
        if (res.ok && data.teamMembersOnLeave) {
          setTeamMembersOnLeave(data.teamMembersOnLeave);
        } else {
          setTeamMembersOnLeave([]);
        }
      } catch (err) {
        console.error('Error fetching team members on leave:', err);
        setTeamMembersOnLeave([]);
      } finally {
        setLoadingTeamMembers(false);
      }
    };

    // Debounce the API call
    const timer = setTimeout(fetchTeamMembersOnLeave, 500);
    return () => clearTimeout(timer);
  }, [formData.startDate, formData.endDate]);

  const fetchAllottedLeaveTypes = async () => {
    try {
      const res = await fetch('/api/leave/allotted-types');
      const data = await res.json();
      setLeaveTypes(data.leaveTypes || []);
    } catch (err) {
      console.error('Error fetching allotted leave types:', err);
    }
  };

  const handleRequestLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Check if selected leave type is halfday or shortday
    const selectedLeaveType = leaveTypes.find((type) => type._id === formData.leaveType);
    const isHalfDay = selectedLeaveType?.name?.toLowerCase().includes('halfday') || 
                     selectedLeaveType?.name?.toLowerCase().includes('half-day') || 
                     selectedLeaveType?.name?.toLowerCase().includes('half day');
    const isShortDay = selectedLeaveType?.name?.toLowerCase().includes('shortday') || 
                      selectedLeaveType?.name?.toLowerCase().includes('short-day') || 
                      selectedLeaveType?.name?.toLowerCase().includes('short day');
    
    // Validate half-day selection
    if (isHalfDay && !formData.halfDayType) {
      toast.error('Please select first half or second half for half-day leave');
      setLoading(false);
      return;
    }

    // Validate short-day selection
    if (isShortDay && (!formData.shortDayFromTime || !formData.shortDayToTime)) {
      toast.error('Please select from and to time for short-day leave');
      setLoading(false);
      return;
    }

    // Validate short-day time range
    if (isShortDay && formData.shortDayFromTime && formData.shortDayToTime) {
      const fromTime = new Date(`2000-01-01T${formData.shortDayFromTime}`);
      const toTime = new Date(`2000-01-01T${formData.shortDayToTime}`);
      if (toTime <= fromTime) {
        toast.error('To time must be after From time');
        setLoading(false);
        return;
      }
    }

    // Check balance before submitting
    if (formData.leaveType && formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      // For half-day, use 0.5 days; for short-day, calculate based on time range; otherwise calculate normally
      let requestedDays: number;
      if (isHalfDay) {
        requestedDays = 0.5;
      } else if (isShortDay && formData.shortDayFromTime && formData.shortDayToTime) {
        // Calculate days based on hours for short-day
        const fromTime = new Date(`2000-01-01T${formData.shortDayFromTime}`);
        const toTime = new Date(`2000-01-01T${formData.shortDayToTime}`);
        const hours = (toTime.getTime() - fromTime.getTime()) / (1000 * 60 * 60);
        requestedDays = hours / 24; // Convert hours to days
      } else if (isShortDay) {
        requestedDays = 0.25; // Fallback if times not provided
      } else {
        requestedDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }

      // Find the allotted leave for this leave type
      const allottedLeavesList = leaves.filter((leave) => leave.allottedBy);
      const allottedLeave = allottedLeavesList.find((leave) => {
        const leaveTypeId = typeof leave.leaveType === 'object' ? leave.leaveType?._id : leave.leaveType;
        return leaveTypeId === formData.leaveType;
      });

      if (allottedLeave) {
        const remainingDays = allottedLeave.remainingDays !== undefined ? allottedLeave.remainingDays : (allottedLeave.days || 0);
        if (remainingDays < requestedDays) {
          const requestedDaysDisplay = requestedDays === 0.5 ? '0.5' : 
                                      requestedDays < 1 && requestedDays > 0 ? requestedDays.toFixed(2) : 
                                      requestedDays.toString();
          toast.error(`Insufficient leave balance. You have ${remainingDays} days remaining, but requested ${requestedDaysDisplay} ${requestedDays === 0.5 || (requestedDays < 1 && requestedDays > 0) ? 'day' : 'days'}.`);
          setLoading(false);
          return;
        }
      }
    }

    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'An error occurred');
        setLoading(false);
        return;
      }

      toast.success('Leave request submitted successfully');
      setShowRequestModal(false);
      setFormData({ leaveType: '', startDate: '', endDate: '', reason: '', halfDayType: '', shortDayFromTime: '', shortDayToTime: '' });
      // Refresh leaves
      const leavesRes = await fetch('/api/leave');
      const leavesData = await leavesRes.json();
      setLeaves(leavesData.leaves || []);
      if (onLeavesUpdated) {
        onLeavesUpdated();
      }
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
      setLoading(false);
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

    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        // Revert on error
        setLeaves(previousLeaves);
        const data = await res.json();
        toast.error(data.error || 'Failed to delete leave request');
        setDeleting(false);
        setDeleteModal({ isOpen: false, leave: null });
        return;
      }

      // Show success only after API confirms deletion
      toast.success('Leave request deleted successfully');

      // Refresh the list if callback is provided
      if (onLeavesUpdated) {
        onLeavesUpdated();
      }
      setDeleting(false);
      setDeleteModal({ isOpen: false, leave: null });
    } catch (err) {
      // Revert on error
      setLeaves(previousLeaves);
      toast.error('An error occurred while deleting leave request');
      setDeleting(false);
      setDeleteModal({ isOpen: false, leave: null });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <X className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  // Separate allotted leaves and leave requests
  const allottedLeaves = leaves.filter((leave) => leave.allottedBy);
  const leaveRequests = leaves.filter((leave) => !leave.allottedBy);

  // Pagination logic for leave requests
  const paginatedLeaveRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return leaveRequests.slice(startIndex, endIndex);
  }, [leaveRequests, currentPage]);

  const totalPages = Math.ceil(leaveRequests.length / itemsPerPage);

  // Reset to page 1 when leave requests change
  useEffect(() => {
    setCurrentPage(1);
  }, [leaveRequests.length]);

  return (
    <div className="space-y-6">
      {/* Header with Request Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-primary font-semibold text-gray-800">My Allotted Leaves</h2>
          <p className="text-sm text-gray-600 mt-0.5 mr-3 font-secondary">
            View your allotted leaves and request new ones
          </p>
        </div>
        <button
          onClick={() => setShowRequestModal(true)}
          disabled={leaveTypes.length === 0}
          className="w-[200px] flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span className="font-secondary">Request Leave</span>
        </button>
      </div>

      {/* Allotted Leaves Cards with Circle Charts */}
      {allottedLeaves.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-secondary">No leaves allotted yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allottedLeaves.map((leave) => {
            const totalDays = leave.days || 0;
            const remainingDays = leave.remainingDays !== undefined ? leave.remainingDays : totalDays;
            const usedDays = totalDays - remainingDays;

            return (
              <motion.div
                key={leave._id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl p-5 hover:shadow-md transition-all duration-300 hover:border-primary/20"
              >
                <div className="flex items-center gap-5 sm:flex-row">
                  {/* Circle Progress Chart - Left Side */}
                  <div className="flex-shrink-0">
                    <CircleProgress
                      value={remainingDays}
                      max={totalDays}
                      strokeWidth={10}
                      size={100}
                    />
                  </div>

                  {/* Text Content - Right Side */}
                  <div className="flex-1 min-w-0">
                    {/* Leave Type Name */}
                    <h3 className="text-md font-primary font-black text-gray-800 mb-3">
                      {typeof leave.leaveType === 'object' ? leave.leaveType?.name : leave.leaveType}
                    </h3>

                    {/* Leave Balance Info */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-green-100 px-1 py-1 rounded-lg">
                        <span className="text-sm text-gray-600 font-secondary">Total</span>
                        <span className="text-sm font-primary font-semibold text-green-600">{totalDays} days</span>
                      </div>
                      <div className="flex items-center justify-between bg-red-100 px-1 py-1 rounded-lg">
                        <span className="text-sm text-gray-600 font-secondary">Used</span>
                        <span className="text-sm font-primary font-semibold text-red-600 ">
                          {usedDays} days
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-sm font-secondary font-medium text-gray-700">Remaining</span>
                        <span className="text-lg font-primary font-bold text-primary">{remainingDays} days</span>
                      </div>
                    </div>

                    {/* Carry Forward Indicator */}
                    {leave.carryForward && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-primary font-secondary bg-primary/10 px-2 py-1 rounded-full w-fit">
                        <CheckCircle className="w-3 h-3" />
                        <span>Carried forward</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Leave Request History */}
      <div className="mt-6">
        <div className="mb-4">
          <h2 className="text-lg font-primary font-semibold text-gray-800">Leave Request History</h2>
          <p className="text-sm text-gray-600 mt-0.5 font-secondary">
            Track all your leave requests and their approval status
          </p>
        </div>

        {leaveRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-secondary">No leave requests yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                      Leave Type
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
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedLeaveRequests.map((leave) => (
                    <motion.tr
                      key={leave._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50"
                    >
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        {leave.status === 'pending' && (
                          <button
                            onClick={() => handleDeleteClick(leave)}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={leaveRequests.length}
                itemsPerPage={itemsPerPage}
              />
            )}
          </div>
        )}
      </div>

      {/* Request Leave Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 p-4 w-full max-w-md my-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-primary font-bold text-gray-800">Request Leave</h2>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRequestLeave} className="space-y-3">
              {/* Leave Type Selection - Compact Cards */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2 font-secondary">
                  Select Leave Type
                </label>
                {leaveTypes.length === 0 ? (
                  <div className="p-3 bg-gray-50/80 backdrop-blur-sm rounded-lg border border-gray-200/50">
                    <p className="text-xs text-gray-600 font-secondary text-center">
                      You need to have leaves allotted by admin/HR before you can request leave
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {leaveTypes.map((type) => {
                      const isSelected = formData.leaveType === type._id;
                      return (
                        <motion.button
                          key={type._id}
                          type="button"
                          onClick={() => setFormData({ ...formData, leaveType: type._id })}
                          className={`p-2 rounded-lg border transition-all text-center relative ${isSelected
                            ? 'border-primary bg-primary/10 shadow-md'
                            : 'border-gray-200/50 bg-white/50 hover:border-gray-300 hover:bg-white/70'
                            }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`text-[12px] font-medium font-primary ${isSelected ? 'text-primary' : 'text-gray-700'}`}>
                              {type.name}
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Half-Day Selection - Only shown when halfday leave type is selected */}
              {formData.leaveType && (() => {
                const selectedLeaveType = leaveTypes.find((type) => type._id === formData.leaveType);
                const isHalfDay = selectedLeaveType?.name?.toLowerCase().includes('halfday') || 
                                 selectedLeaveType?.name?.toLowerCase().includes('half-day') || 
                                 selectedLeaveType?.name?.toLowerCase().includes('half day');
                
                if (isHalfDay) {
                  return (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-gradient-to-r from-purple-50/80 to-pink-50/80 backdrop-blur-sm rounded-lg p-3 border border-purple-200/50"
                    >
                      <label className="block text-xs font-medium text-gray-700 mb-2 font-secondary">
                        Select Half Day
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <motion.button
                          type="button"
                          onClick={() => setFormData({ ...formData, halfDayType: 'first-half' })}
                          className={`p-2.5 rounded-lg border transition-all text-center ${
                            formData.halfDayType === 'first-half'
                              ? 'border-purple-500 bg-purple-100 shadow-md'
                              : 'border-gray-200/50 bg-white/50 hover:border-gray-300 hover:bg-white/70'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-sm font-medium font-primary ${
                              formData.halfDayType === 'first-half' ? 'text-purple-700' : 'text-gray-700'
                            }`}>
                              First Half
                            </span>
                            <span className="text-[10px] text-gray-500 font-secondary">Morning</span>
                          </div>
                        </motion.button>
                        <motion.button
                          type="button"
                          onClick={() => setFormData({ ...formData, halfDayType: 'second-half' })}
                          className={`p-2.5 rounded-lg border transition-all text-center ${
                            formData.halfDayType === 'second-half'
                              ? 'border-purple-500 bg-purple-100 shadow-md'
                              : 'border-gray-200/50 bg-white/50 hover:border-gray-300 hover:bg-white/70'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-sm font-medium font-primary ${
                              formData.halfDayType === 'second-half' ? 'text-purple-700' : 'text-gray-700'
                            }`}>
                              Second Half
                            </span>
                            <span className="text-[10px] text-gray-500 font-secondary">Afternoon</span>
                          </div>
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                }
                return null;
              })()}

              {/* Short-Day Time Selection - Only shown when shortday leave type is selected */}
              {formData.leaveType && (() => {
                const selectedLeaveType = leaveTypes.find((type) => type._id === formData.leaveType);
                const isShortDay = selectedLeaveType?.name?.toLowerCase().includes('shortday') || 
                                  selectedLeaveType?.name?.toLowerCase().includes('short-day') || 
                                  selectedLeaveType?.name?.toLowerCase().includes('short day');
                
                if (isShortDay) {
                  // Calculate total hours
                  let totalHours = 0;
                  let totalHoursDisplay = '';
                  if (formData.shortDayFromTime && formData.shortDayToTime) {
                    const fromTime = new Date(`2000-01-01T${formData.shortDayFromTime}`);
                    const toTime = new Date(`2000-01-01T${formData.shortDayToTime}`);
                    if (toTime > fromTime) {
                      totalHours = (toTime.getTime() - fromTime.getTime()) / (1000 * 60 * 60);
                      const hours = Math.floor(totalHours);
                      const minutes = Math.round((totalHours - hours) * 60);
                      if (hours > 0 && minutes > 0) {
                        totalHoursDisplay = `${hours}h ${minutes}m`;
                      } else if (hours > 0) {
                        totalHoursDisplay = `${hours}h`;
                      } else {
                        totalHoursDisplay = `${minutes}m`;
                      }
                    }
                  }

                  return (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-gradient-to-r from-blue-50/80 to-cyan-50/80 backdrop-blur-sm rounded-lg p-3 border border-blue-200/50"
                    >
                      <label className="block text-xs font-medium text-gray-700 mb-2 font-secondary">
                        Select Time Range
                      </label>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-600 mb-1 font-secondary">
                            From
                          </label>
                          <input
                            type="time"
                            value={formData.shortDayFromTime}
                            onChange={(e) => setFormData({ ...formData, shortDayFromTime: e.target.value })}
                            required
                            className="w-full px-2 py-1.5 text-xs text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-secondary bg-white/80 backdrop-blur-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-600 mb-1 font-secondary">
                            To
                          </label>
                          <input
                            type="time"
                            value={formData.shortDayToTime}
                            onChange={(e) => setFormData({ ...formData, shortDayToTime: e.target.value })}
                            required
                            min={formData.shortDayFromTime || undefined}
                            className="w-full px-2 py-1.5 text-xs text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-secondary bg-white/80 backdrop-blur-sm"
                          />
                        </div>
                      </div>
                      {totalHoursDisplay && formData.shortDayFromTime && formData.shortDayToTime && (
                        <div className="mt-2 p-2 bg-blue-100/80 rounded-lg border border-blue-200/50">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-medium text-gray-700 font-secondary">Time Range:</span>
                              <span className="text-xs font-bold text-blue-700 font-primary">
                                {formatTime12Hour(formData.shortDayFromTime)} - {formatTime12Hour(formData.shortDayToTime)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-medium text-gray-700 font-secondary">Total Hours:</span>
                              <span className="text-xs font-bold text-blue-700 font-primary">{totalHoursDisplay}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-500 mt-1 font-secondary">
                        Select the time range for your short-day leave
                      </p>
                    </motion.div>
                  );
                }
                return null;
              })()}

              {/* Selected Leave Type Balance Details - Only shown when selected */}
              {formData.leaveType && (() => {
                const selectedAllottedLeave = leaves.find((leave) => {
                  const leaveTypeId = typeof leave.leaveType === 'object' ? leave.leaveType?._id : leave.leaveType;
                  return leave.allottedBy && leaveTypeId === formData.leaveType;
                });

                if (selectedAllottedLeave) {
                  const totalDays = selectedAllottedLeave.days || 0;
                  const remainingDays = selectedAllottedLeave.remainingDays !== undefined
                    ? selectedAllottedLeave.remainingDays
                    : totalDays;
                  const consumedDays = totalDays - remainingDays;

                  return (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 backdrop-blur-sm rounded-lg p-3 border border-blue-200/50"
                    >
                      <h3 className="text-xs font-semibold text-gray-800 mb-2 font-primary">Leave Balance</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <div className="text-xl font-bold text-gray-800 font-primary">{totalDays}</div>
                          <div className="text-[10px] text-gray-600 mt-0.5 font-secondary">Total</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-red-600 font-primary">{consumedDays}</div>
                          <div className="text-[10px] text-gray-600 mt-0.5 font-secondary">Consumed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-600 font-primary">{remainingDays}</div>
                          <div className="text-[10px] text-gray-600 mt-0.5 font-secondary">Available</div>
                        </div>
                      </div>
                    </motion.div>
                  );
                }
                return null;
              })()}

              {/* Date Selection */}
              {(() => {
                const selectedLeaveType = leaveTypes.find((type) => type._id === formData.leaveType);
                const isHalfDay = selectedLeaveType?.name?.toLowerCase().includes('halfday') || 
                                 selectedLeaveType?.name?.toLowerCase().includes('half-day') || 
                                 selectedLeaveType?.name?.toLowerCase().includes('half day');
                const isShortDay = selectedLeaveType?.name?.toLowerCase().includes('shortday') || 
                                  selectedLeaveType?.name?.toLowerCase().includes('short-day') || 
                                  selectedLeaveType?.name?.toLowerCase().includes('short day');
                const isSingleDay = isHalfDay || isShortDay; // Both half-day and short-day use same date
                
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1 font-secondary">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => {
                          const newStartDate = e.target.value;
                          // For half-day and short-day, automatically set end date to same as start date
                          setFormData({ 
                            ...formData, 
                            startDate: newStartDate,
                            ...(isSingleDay && { endDate: newStartDate })
                          });
                        }}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-2 py-1.5 text-xs text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white/80 backdrop-blur-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1 font-secondary">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        required
                        min={formData.startDate || new Date().toISOString().split('T')[0]}
                        max={isSingleDay ? formData.startDate : undefined}
                        disabled={isSingleDay}
                        className="w-full px-2 py-1.5 text-xs text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white/80 backdrop-blur-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      {isSingleDay && formData.startDate && (
                        <p className="text-[9px] text-gray-500 mt-0.5 font-secondary">
                          Same as start date
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Requested Days Display */}
              {formData.startDate && formData.endDate && (() => {
                const selectedLeaveType = leaveTypes.find((type) => type._id === formData.leaveType);
                const isHalfDay = selectedLeaveType?.name?.toLowerCase().includes('halfday') || 
                                 selectedLeaveType?.name?.toLowerCase().includes('half-day') || 
                                 selectedLeaveType?.name?.toLowerCase().includes('half day');
                const isShortDay = selectedLeaveType?.name?.toLowerCase().includes('shortday') || 
                                  selectedLeaveType?.name?.toLowerCase().includes('short-day') || 
                                  selectedLeaveType?.name?.toLowerCase().includes('short day');
                
                const start = new Date(formData.startDate);
                const end = new Date(formData.endDate);
                // For half-day, use 0.5 days; for short-day, use 0.25 days; otherwise calculate normally
                let requestedDays: number;
                if (isHalfDay) {
                  requestedDays = 0.5;
                } else if (isShortDay) {
                  requestedDays = 0.25;
                } else {
                  requestedDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                }
                const selectedAllottedLeave = leaves.find((leave) => {
                  const leaveTypeId = typeof leave.leaveType === 'object' ? leave.leaveType?._id : leave.leaveType;
                  return leave.allottedBy && leaveTypeId === formData.leaveType;
                });
                const remainingDays = selectedAllottedLeave?.remainingDays !== undefined
                  ? selectedAllottedLeave.remainingDays
                  : (selectedAllottedLeave?.days || 0);
                const isInsufficient = remainingDays < requestedDays;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg p-3 border backdrop-blur-sm ${isInsufficient
                      ? 'bg-red-50/80 border-red-200/50'
                      : 'bg-green-50/80 border-green-200/50'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-gray-700 font-secondary">Requested Days</div>
                        <div className={`text-xl font-bold mt-0.5 font-primary ${isInsufficient ? 'text-red-600' : 'text-green-600'
                          }`}>
                          {requestedDays === 0.5 ? '0.5 day' : 
                           requestedDays < 1 && requestedDays > 0 ? `${requestedDays.toFixed(2)} day` : 
                           `${requestedDays} ${requestedDays === 1 ? 'day' : 'days'}`}
                        </div>
                      </div>
                      {isInsufficient && (
                        <div className="text-right">
                          <div className="text-[10px] text-red-600 font-secondary font-medium">
                            Insufficient
                          </div>
                          <div className="text-xs text-red-700 font-primary font-semibold mt-0.5">
                            Available: {remainingDays}
                          </div>
                        </div>
                      )}
                      {!isInsufficient && selectedAllottedLeave && (
                        <div className="text-right">
                          <div className="text-[10px] text-green-600 font-secondary font-medium">
                            Remaining
                          </div>
                          <div className="text-xs text-green-700 font-primary font-semibold mt-0.5">
                            {remainingDays - requestedDays} days
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })()}

              {/* Team Members on Leave */}
              {formData.startDate && formData.endDate && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg p-3 border border-orange-200/50 bg-orange-50/80 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-orange-600" />
                    <h3 className="text-xs font-semibold text-gray-800 font-primary">
                      Team Members on Leave
                    </h3>
                  </div>
                  {loadingTeamMembers ? (
                    <div className="flex items-center justify-center py-2">
                      <LoadingDots size="sm" />
                    </div>
                  ) : teamMembersOnLeave.length === 0 ? (
                    <p className="text-xs text-gray-600 font-secondary">
                      No team members have leave during this period
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {teamMembersOnLeave
                        .filter((member: any) => member.leaves && member.leaves.length > 0) // Additional safety check
                        .map((member) => (
                        <div
                          key={member._id}
                          className="flex items-center gap-2 p-2 bg-white/60 rounded-lg border border-orange-200/30"
                        >
                          <UserAvatar
                            name={member.name}
                            image={member.profileImage}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-800 font-primary truncate">
                              {member.name}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {member.leaves.map((leave: any, idx: number) => {
                                // Check if this is a half-day leave
                                const isHalfDay = leave.days === 0.5 || leave.halfDayType;
                                const halfDayLabel = leave.halfDayType === 'first-half' ? 'First Half' : 
                                                    leave.halfDayType === 'second-half' ? 'Second Half' : '';
                                
                                return (
                                  <span
                                    key={idx}
                                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full font-secondary ${
                                      leave.status === 'approved'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                    }`}
                                  >
                                    {leave.leaveType}
                                    {isHalfDay && halfDayLabel && ` (${halfDayLabel})`}
                                    {' '}({format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd')})
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 font-secondary">
                  Reason
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  required
                  rows={2}
                  placeholder="Reason for leave..."
                  className="w-full px-2 py-1.5 text-xs text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white/80 backdrop-blur-sm resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-gray-200/50">
                <button
                  type="button"
                  onClick={() => {
                    setShowRequestModal(false);
                    setFormData({ leaveType: '', startDate: '', endDate: '', reason: '', halfDayType: '', shortDayFromTime: '', shortDayToTime: '' });
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300/50 rounded-lg text-gray-700 hover:bg-gray-50/80 backdrop-blur-sm transition-colors font-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.leaveType || !formData.startDate || !formData.endDate || !formData.reason}
                  className="flex-1 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-secondary flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <LoadingDots size="sm" color="white" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

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
                {deleteModal.leave.days === 0.5 ? '0.5 day' : 
                 deleteModal.leave.days && deleteModal.leave.days < 1 && deleteModal.leave.days > 0 
                 ? `${deleteModal.leave.days.toFixed(2)} day${deleteModal.leave.shortDayTime ? ` (${formatTimeRange(deleteModal.leave.shortDayTime)})` : ''}` 
                 : `${deleteModal.leave.days || 'N/A'} ${deleteModal.leave.days === 1 ? 'day' : 'days'}`}
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

