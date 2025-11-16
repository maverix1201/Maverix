'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, Clock, User, CheckCircle, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import CircleProgress from './CircleProgress';
import LoadingDots from './LoadingDots';
import DeleteConfirmationModal from './DeleteConfirmationModal';

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
  });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; leave: Leave | null }>({
    isOpen: false,
    leave: null,
  });
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchAllottedLeaveTypes();
  }, []);

  useEffect(() => {
    setLeaves(initialLeaves);
  }, [initialLeaves]);

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

    // Check balance before submitting
    if (formData.leaveType && formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const requestedDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Find the allotted leave for this leave type
      const allottedLeavesList = leaves.filter((leave) => leave.allottedBy);
      const allottedLeave = allottedLeavesList.find((leave) => {
        const leaveTypeId = typeof leave.leaveType === 'object' ? leave.leaveType?._id : leave.leaveType;
        return leaveTypeId === formData.leaveType;
      });

      if (allottedLeave) {
        const remainingDays = allottedLeave.remainingDays !== undefined ? allottedLeave.remainingDays : (allottedLeave.days || 0);
        if (remainingDays < requestedDays) {
          toast.error(`Insufficient leave balance. You have ${remainingDays} days remaining, but requested ${requestedDays} days.`);
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
      setFormData({ leaveType: '', startDate: '', endDate: '', reason: '' });
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
                  {leaveRequests.map((leave) => (
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
                          {leave.days || 'N/A'} {leave.days === 1 ? 'day' : 'days'}
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
          </div>
        )}
      </div>

      {/* Request Leave Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-5 w-full max-w-lg my-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-primary font-bold text-gray-800">Request Leave</h2>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRequestLeave} className="space-y-4">
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
                  <div className="grid grid-cols-2 gap-2">
                    {leaveTypes.map((type) => {
                      const isSelected = formData.leaveType === type._id;
                      return (
                        <motion.button
                          key={type._id}
                          type="button"
                          onClick={() => setFormData({ ...formData, leaveType: type._id })}
                          className={`p-2.5 rounded-lg border transition-all text-center relative ${isSelected
                            ? 'border-primary bg-primary/10 shadow-md'
                            : 'border-gray-200/50 bg-white/50 hover:border-gray-300 hover:bg-white/70'
                            }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`text-sm font-medium font-primary ${isSelected ? 'text-primary' : 'text-gray-700'}`}>
                              {type.name}
                            </span>
                            {isSelected && (
                              <CheckCircle className="w-4 h-4 text-primary" />
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-secondary">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-2.5 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white/80 backdrop-blur-sm"
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
                    className="w-full px-2.5 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white/80 backdrop-blur-sm"
                  />
                </div>
              </div>

              {/* Requested Days Display */}
              {formData.startDate && formData.endDate && (() => {
                const start = new Date(formData.startDate);
                const end = new Date(formData.endDate);
                const requestedDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
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
                          {requestedDays} {requestedDays === 1 ? 'day' : 'days'}
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

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 font-secondary">
                  Reason
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  required
                  rows={3}
                  placeholder="Please provide a reason for your leave request..."
                  className="w-full px-2.5 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white/80 backdrop-blur-sm resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t border-gray-200/50">
                <button
                  type="button"
                  onClick={() => {
                    setShowRequestModal(false);
                    setFormData({ leaveType: '', startDate: '', endDate: '', reason: '' });
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
                <span className="font-semibold">Days:</span> {deleteModal.leave.days || 'N/A'}
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

