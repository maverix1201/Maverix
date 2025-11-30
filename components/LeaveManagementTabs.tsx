'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Check, X, Calendar, Clock, Trash2, Search, Filter, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import LeaveManagement from './LeaveManagement';
import AllottedLeavesList from './AllottedLeavesList';
import DeleteConfirmationModal from './DeleteConfirmationModal';
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
  createdAt: string;
  allottedBy?: {
    _id: string;
    name: string;
  };
}

interface LeaveType {
  _id: string;
  name: string;
  description?: string;
  maxDays?: number;
}

interface LeaveManagementTabsProps {
  initialLeaves: Leave[];
  role: 'admin' | 'hr';
}

export default function LeaveManagementTabs({ initialLeaves, role }: LeaveManagementTabsProps) {
  const [activeTab, setActiveTab] = useState<'requests' | 'types' | 'allot'>('requests');
  const [leaves, setLeaves] = useState(initialLeaves);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [showAllotModal, setShowAllotModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedLeaveTypes, setSelectedLeaveTypes] = useState<{ leaveTypeId: string; leaveTypeName: string; days: string }[]>([]);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [showLeaveTypeDropdown, setShowLeaveTypeDropdown] = useState(false);
  const [searchEmployee, setSearchEmployee] = useState('');
  const [searchLeaveType, setSearchLeaveType] = useState('');
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editingEmployeeLeaves, setEditingEmployeeLeaves] = useState<any[]>([]);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const leaveTypeDropdownRef = useRef<HTMLDivElement>(null);
  const [typeFormData, setTypeFormData] = useState({
    name: '',
    description: '',
    maxDays: '',
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; leaveType: LeaveType | null }>({
    isOpen: false,
    leaveType: null,
  });
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchLeaveTypes();
    fetchEmployees();
    fetchLeaves();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        employeeDropdownRef.current &&
        !employeeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowEmployeeDropdown(false);
      }
      if (
        leaveTypeDropdownRef.current &&
        !leaveTypeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowLeaveTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchLeaves = async () => {
    try {
      const res = await fetch('/api/leave');
      const data = await res.json();
      setLeaves(data.leaves || []);
    } catch (err) {
      console.error('Error fetching leaves:', err);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const res = await fetch('/api/leave-types');
      const data = await res.json();
      setLeaveTypes(data.leaveTypes || []);
    } catch (err) {
      console.error('Error fetching leave types:', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setEmployees(data.users?.filter((u: any) => u.role === 'employee') || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const toggleLeaveType = (leaveType: LeaveType) => {
    const isSelected = selectedLeaveTypes.some((lt) => lt.leaveTypeId === leaveType._id);
    if (isSelected) {
      setSelectedLeaveTypes((prev) => prev.filter((lt) => lt.leaveTypeId !== leaveType._id));
    } else {
      setSelectedLeaveTypes((prev) => [
        ...prev,
        { leaveTypeId: leaveType._id, leaveTypeName: leaveType.name, days: '' },
      ]);
    }
  };

  const updateLeaveTypeDays = (leaveTypeId: string, days: string) => {
    setSelectedLeaveTypes((prev) =>
      prev.map((lt) => (lt.leaveTypeId === leaveTypeId ? { ...lt, days } : lt))
    );
  };

  const removeLeaveType = (leaveTypeId: string) => {
    setSelectedLeaveTypes((prev) => prev.filter((lt) => lt.leaveTypeId !== leaveTypeId));
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchEmployee.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchEmployee.toLowerCase())
  );

  const filteredLeaveTypes = leaveTypes.filter((lt) =>
    lt.name.toLowerCase().includes(searchLeaveType.toLowerCase())
  );

  const handleEditEmployee = (employeeId: string, employeeLeaves: any[]) => {
    // Pre-fill the modal with employee and their leave types
    setEditingEmployeeId(employeeId);
    setEditingEmployeeLeaves(employeeLeaves);
    setSelectedEmployees([employeeId]);
    
    // Map employee leaves to selected leave types format
    const preSelectedLeaveTypes = employeeLeaves.map((leave) => ({
      leaveTypeId: typeof leave.leaveType === 'object' ? leave.leaveType._id : leave.leaveType,
      leaveTypeName: typeof leave.leaveType === 'object' ? leave.leaveType.name : leave.leaveType,
      days: leave.days?.toString() || '',
    }));
    
    setSelectedLeaveTypes(preSelectedLeaveTypes);
    setShowAllotModal(true);
  };

  const handleAllotLeave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedEmployees.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    if (selectedLeaveTypes.length === 0) {
      toast.error('Please select at least one leave type');
      return;
    }

    // Validate all leave types have days entered
    const invalidLeaveTypes = selectedLeaveTypes.filter((lt) => !lt.days || parseInt(lt.days) <= 0);
    if (invalidLeaveTypes.length > 0) {
      toast.error('Please enter valid days for all selected leave types');
      return;
    }

    setLoading(true);

    try {
      // If editing, delete old leaves first
      if (editingEmployeeId && editingEmployeeLeaves.length > 0) {
        const deletePromises = editingEmployeeLeaves.map((leave) =>
          fetch(`/api/leave/${leave._id}`, { method: 'DELETE' })
        );
        await Promise.all(deletePromises);
      }

      // Create allocations for all combinations
      const allocations: any[] = [];
      selectedEmployees.forEach((userId) => {
        selectedLeaveTypes.forEach((lt) => {
          allocations.push({
            userId,
            leaveType: lt.leaveTypeId,
            days: parseInt(lt.days),
            reason: `Allotted by ${role === 'admin' ? 'Admin' : 'HR'}`,
          });
        });
      });

      const res = await fetch('/api/leave/allot/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'An error occurred');
        setLoading(false);
        return;
      }

      if (data.errorCount > 0) {
        toast.error(`Allotted ${data.successCount} leave(s), but ${data.errorCount} failed. Check console for details.`);
        console.error('Allotment errors:', data.errors);
      } else {
        toast.success(editingEmployeeId ? `Successfully updated ${data.successCount} leave(s)` : `Successfully allotted ${data.successCount} leave(s)`);
      }

      setShowAllotModal(false);
      setSelectedEmployees([]);
      setSelectedLeaveTypes([]);
      setSearchEmployee('');
      setSearchLeaveType('');
      setEditingEmployeeId(null);
      setEditingEmployeeLeaves([]);
      fetchLeaves();
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const handleAddLeaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/leave-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeFormData),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'An error occurred');
        setLoading(false);
        return;
      }

      toast.success('Leave type added successfully');
      setShowTypeModal(false);
      setTypeFormData({ name: '', description: '', maxDays: '' });
      fetchLeaveTypes();
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const handleDeleteLeaveTypeClick = (leaveType: LeaveType) => {
    setDeleteModal({ isOpen: true, leaveType });
  };

  const handleDeleteLeaveTypeConfirm = async () => {
    if (!deleteModal.leaveType) return;

    const id = deleteModal.leaveType._id;
    setDeleting(true);

    // Optimistic update - remove immediately from UI
    const previousTypes = [...leaveTypes];
    setLeaveTypes(leaveTypes.filter((type) => type._id !== id));
    toast.success('Leave type deleted successfully');

    try {
      const res = await fetch(`/api/leave-types?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        // Revert on error
        setLeaveTypes(previousTypes);
        toast.error('Failed to delete leave type');
        setDeleting(false);
        setDeleteModal({ isOpen: false, leaveType: null });
        return;
      }
      setDeleting(false);
      setDeleteModal({ isOpen: false, leaveType: null });
    } catch (err) {
      // Revert on error
      setLeaveTypes(previousTypes);
      toast.error('An error occurred');
      setDeleting(false);
      setDeleteModal({ isOpen: false, leaveType: null });
    }
  };

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

  // Filter leaves - show all leave requests (not allotted leaves)
  const leaveRequests = leaves.filter((leave) => !leave.allottedBy);

  return (
    <div>
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-4">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'requests'
                ? 'text-primary border-b-2 border-primary bg-primary-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Leave Requests ({leaveRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('types')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'types'
                ? 'text-primary border-b-2 border-primary bg-primary-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Leave Types
          </button>
          <button
            onClick={() => setActiveTab('allot')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'allot'
                ? 'text-primary border-b-2 border-primary bg-primary-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Allot Leave
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'requests' && (
        <LeaveManagement
          initialLeaves={leaveRequests}
          canApprove={true}
          onLeaveAdded={fetchLeaves}
          employees={employees}
          leaveTypes={leaveTypes}
        />
      )}

      {activeTab === 'types' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-primary font-semibold text-gray-800">Leave Types</h2>
            <button
              onClick={() => setShowTypeModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="font-secondary">Add Leave Type</span>
            </button>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leaveTypes.map((type) => (
                <div
                  key={type._id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-primary font-semibold text-gray-800 mb-1">
                        {type.name}
                      </h3>
                      {type.description && (
                        <p className="text-sm text-gray-600 font-secondary mb-2">{type.description}</p>
                      )}
                      {type.maxDays && (
                        <p className="text-xs text-gray-500 font-secondary">Max: {type.maxDays} days</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteLeaveTypeClick(type)}
                      className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'allot' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-primary font-semibold text-gray-800">Allot Leave to Employee</h2>
              <button
                onClick={() => setShowAllotModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="font-secondary">Allot Leave</span>
              </button>
            </div>
          </div>

          {/* Allotted Leaves List */}
          <AllottedLeavesList 
            leaves={leaves} 
            employees={employees} 
            onRefresh={fetchLeaves}
            onEditEmployee={handleEditEmployee}
          />
        </div>
      )}

      {/* Bulk Allot Leave Modal */}
      {showAllotModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl my-4"
          >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-primary font-bold text-gray-800">
                  {editingEmployeeId ? 'Edit Employee Leaves' : 'Bulk Leave Allotment'}
                </h2>
                <button
                  onClick={() => {
                    setShowAllotModal(false);
                    setSelectedEmployees([]);
                    setSelectedLeaveTypes([]);
                    setSearchEmployee('');
                    setSearchLeaveType('');
                    setEditingEmployeeId(null);
                    setEditingEmployeeLeaves([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

            <form onSubmit={handleAllotLeave} className="space-y-5">
              {/* Employee Multi-Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-secondary">
                  Select Employees <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={employeeDropdownRef}>
                  <div
                    onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                    className="w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white cursor-pointer flex items-center justify-between"
                >
                    <span className={selectedEmployees.length === 0 ? 'text-gray-400' : ''}>
                      {selectedEmployees.length === 0
                        ? 'Select Employees'
                        : `${selectedEmployees.length} employee(s) selected`}
                    </span>
                    <Users className="w-4 h-4 text-gray-400" />
                  </div>

                  {showEmployeeDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2 border-b border-gray-200">
                        <input
                          type="text"
                          placeholder="Search employees..."
                          value={searchEmployee}
                          onChange={(e) => setSearchEmployee(e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="p-2 space-y-1">
                        {filteredEmployees.map((emp) => (
                          <label
                            key={emp._id}
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedEmployees.includes(emp._id)}
                              onChange={() => toggleEmployee(emp._id)}
                              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                            />
                            <span className="text-sm text-gray-700 font-secondary">
                              {emp.name} ({emp.email})
                            </span>
                          </label>
                        ))}
                        {filteredEmployees.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-2">No employees found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {selectedEmployees.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedEmployees.map((id) => {
                      const emp = employees.find((e) => e._id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-secondary"
                        >
                          {emp?.name}
                          <button
                            type="button"
                            onClick={() => toggleEmployee(id)}
                            className="hover:text-primary-dark"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Leave Type Multi-Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-secondary">
                  Select Leave Types <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={leaveTypeDropdownRef}>
                  <div
                    onClick={() => setShowLeaveTypeDropdown(!showLeaveTypeDropdown)}
                    className="w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white cursor-pointer flex items-center justify-between"
                  >
                    <span className={selectedLeaveTypes.length === 0 ? 'text-gray-400' : ''}>
                      {selectedLeaveTypes.length === 0
                        ? 'Select Leave Types'
                        : `${selectedLeaveTypes.length} leave type(s) selected`}
                    </span>
                    <Calendar className="w-4 h-4 text-gray-400" />
                  </div>

                  {showLeaveTypeDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2 border-b border-gray-200">
                <input
                          type="text"
                          placeholder="Search leave types..."
                          value={searchLeaveType}
                          onChange={(e) => setSearchLeaveType(e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary outline-none"
                          onClick={(e) => e.stopPropagation()}
                />
              </div>
                      <div className="p-2 space-y-1">
                        {filteredLeaveTypes.map((lt) => (
                          <label
                            key={lt._id}
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          >
                <input
                  type="checkbox"
                              checked={selectedLeaveTypes.some((slt) => slt.leaveTypeId === lt._id)}
                              onChange={() => toggleLeaveType(lt)}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                            <span className="text-sm text-gray-700 font-secondary">{lt.name}</span>
                </label>
                        ))}
                        {filteredLeaveTypes.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-2">No leave types found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Leave Types with Days Input */}
              {selectedLeaveTypes.length > 0 && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 font-secondary">
                    Enter Days for Each Leave Type <span className="text-red-500">*</span>
                </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedLeaveTypes.map((lt) => (
                      <motion.div
                        key={lt.leaveTypeId}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-800 font-primary">
                            {lt.leaveTypeName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={lt.days}
                            onChange={(e) => updateLeaveTypeDays(lt.leaveTypeId, e.target.value)}
                            placeholder="Days"
                            required
                            className="w-24 px-2.5 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                />
                          <button
                            type="button"
                            onClick={() => removeLeaveType(lt.leaveTypeId)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
              </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAllotModal(false);
                    setSelectedEmployees([]);
                    setSelectedLeaveTypes([]);
                    setSearchEmployee('');
                    setSearchLeaveType('');
                  }}
                  className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || selectedEmployees.length === 0 || selectedLeaveTypes.length === 0}
                  className="flex-1 px-4 py-2.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-secondary flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <LoadingDots size="sm" color="white" />
                      <span>Allotting...</span>
                    </>
                  ) : (
                    `Allot to ${selectedEmployees.length} Employee(s)`
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Leave Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl p-5 w-full max-w-md"
          >
            <h2 className="text-xl font-primary font-bold text-gray-800 mb-4">Add Leave Type</h2>

            <form onSubmit={handleAddLeaveType} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
                  Leave Type Name
                </label>
                <input
                  type="text"
                  value={typeFormData.name}
                  onChange={(e) => setTypeFormData({ ...typeFormData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                  placeholder="e.g., Annual Leave, Sick Leave"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
                  Description (Optional)
                </label>
                <textarea
                  value={typeFormData.description}
                  onChange={(e) => setTypeFormData({ ...typeFormData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
                  Max Days (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  value={typeFormData.maxDays}
                  onChange={(e) => setTypeFormData({ ...typeFormData, maxDays: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 font-secondary flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <LoadingDots size="sm" color="white" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    'Add Leave Type'
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
        onClose={() => setDeleteModal({ isOpen: false, leaveType: null })}
        onConfirm={handleDeleteLeaveTypeConfirm}
        title="Delete Leave Type"
        message="Are you sure you want to delete this leave type?"
        details={
          deleteModal.leaveType ? (
            <div className="space-y-1">
              <div>
                <span className="font-semibold">Name:</span> {deleteModal.leaveType.name}
              </div>
              {deleteModal.leaveType.description && (
                <div>
                  <span className="font-semibold">Description:</span> {deleteModal.leaveType.description}
                </div>
              )}
              {deleteModal.leaveType.maxDays && (
                <div>
                  <span className="font-semibold">Max Days:</span> {deleteModal.leaveType.maxDays}
                </div>
              )}
            </div>
          ) : null
        }
        loading={deleting}
      />
    </div>
  );
}

