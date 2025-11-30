'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Plus, X, Users, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/contexts/ToastContext';

interface LeaveType {
  _id: string;
  name: string;
  description?: string;
  maxDays?: number;
}

interface Employee {
  _id: string;
  name: string;
  email: string;
}

interface SelectedLeaveType {
  leaveTypeId: string;
  leaveTypeName: string;
  days: string;
}

export default function AdminLeaveAllotmentPage() {
  const { data: session } = useSession();
  const toast = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedLeaveTypes, setSelectedLeaveTypes] = useState<SelectedLeaveType[]>([]);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [showLeaveTypeDropdown, setShowLeaveTypeDropdown] = useState(false);
  const [searchEmployee, setSearchEmployee] = useState('');
  const [searchLeaveType, setSearchLeaveType] = useState('');
  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const leaveTypeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEmployees();
    fetchLeaveTypes();
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

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setEmployees(data.users?.filter((u: any) => u.role === 'employee') || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
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

  const handleSubmit = async (e: React.FormEvent) => {
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
      // Create allocations for all combinations
      const allocations: any[] = [];
      selectedEmployees.forEach((userId) => {
        selectedLeaveTypes.forEach((lt) => {
          allocations.push({
            userId,
            leaveType: lt.leaveTypeId,
            days: parseInt(lt.days),
            reason: 'Allotted by Admin',
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
        toast.success(`Successfully allotted ${data.successCount} leave(s)`);
      }

      setShowModal(false);
      setSelectedEmployees([]);
      setSelectedLeaveTypes([]);
      setSearchEmployee('');
      setSearchLeaveType('');
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-primary font-bold text-gray-800">Leave Allotment</h1>
            <p className="text-sm text-gray-600 mt-0.5 font-secondary">Allot leaves to employees in bulk</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="font-secondary">Allot Leave</span>
          </button>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl my-4"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-primary font-bold text-gray-800">Bulk Leave Allotment</h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEmployees([]);
                    setSelectedLeaveTypes([]);
                    setSearchEmployee('');
                    setSearchLeaveType('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
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
                      setShowModal(false);
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
                    className="flex-1 px-4 py-2.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-secondary"
                  >
                    {loading ? 'Allotting...' : `Allot to ${selectedEmployees.length} Employee(s)`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
