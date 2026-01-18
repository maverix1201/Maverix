'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Mail, User, Calendar, Clock, Settings, Search, X, Filter } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useSession } from 'next-auth/react';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';
import Pagination from './Pagination';
import { formatTimeString12Hour } from '@/lib/timeUtils';

interface Employee {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'hr' | 'employee';
  empId?: string;
  designation?: string;
  joiningYear?: number;
  emailVerified: boolean;
  approved?: boolean;
  profileImage?: string;
  weeklyOff?: string[];
  clockInTime?: string;
  createdAt?: string;
}

interface EmployeeManagementProps {
  initialEmployees: Employee[];
  canChangeRole?: boolean;
}

export default function EmployeeManagement({ initialEmployees, canChangeRole = true }: EmployeeManagementProps) {
  // Ensure weeklyOff is always an array for initial employees
  const [employees, setEmployees] = useState(
    initialEmployees.map((emp) => ({
      ...emp,
      weeklyOff: Array.isArray(emp.weeklyOff) ? emp.weeklyOff : [],
    }))
  );
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'employee' as 'admin' | 'hr' | 'employee',
    designation: '',
    weeklyOff: [] as string[],
    clockInTime: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; employee: Employee | null }>({
    isOpen: false,
    employee: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [employeesOnLeaveToday, setEmployeesOnLeaveToday] = useState<string[]>([]);
  const [showTimeLimitModal, setShowTimeLimitModal] = useState(false);
  const [defaultTimeLimit, setDefaultTimeLimit] = useState<string>('');
  const [loadingTimeLimit, setLoadingTimeLimit] = useState(false);
  const [maxLateDays, setMaxLateDays] = useState<number>(0);
  const [noClockInRestrictions, setNoClockInRestrictions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [designationFilter, setDesignationFilter] = useState<string>('');
  const { data: session } = useSession();
  const toast = useToast();

  // Check if user is HR or Admin
  const isHROrAdmin = session?.user && ((session.user as any).role === 'hr' || (session.user as any).role === 'admin');

  const handleOpenModal = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      // Check if clockInTime is "N/R" (no restrictions marker)
      const clockInTimeValue = employee.clockInTime || '';
      const hasNoRestrictions = clockInTimeValue === 'N/R' || clockInTimeValue.trim() === '';
      // If it's "N/R", set clockInTime to empty for the form, otherwise use the actual value
      const formClockInTime = clockInTimeValue === 'N/R' ? '' : clockInTimeValue;
      console.log('[EmployeeManagement] Opening modal for employee:', employee.name, 'clockInTime:', clockInTimeValue, 'hasNoRestrictions:', hasNoRestrictions);
      setFormData({
        name: employee.name,
        email: employee.email,
        role: employee.role,
        designation: employee.designation || '',
        weeklyOff: employee.weeklyOff || [],
        clockInTime: formClockInTime,
      });
      setNoClockInRestrictions(hasNoRestrictions);
    } else {
      setEditingEmployee(null);
      setFormData({ name: '', email: '', role: 'employee', designation: '', weeklyOff: [], clockInTime: '' });
      setNoClockInRestrictions(true);
    }
    setShowModal(true);
    setError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
    setFormData({ name: '', email: '', role: 'employee', designation: '', weeklyOff: [], clockInTime: '' });
    setNoClockInRestrictions(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = editingEmployee
        ? `/api/users/${editingEmployee._id}`
        : '/api/users';
      const method = editingEmployee ? 'PUT' : 'POST';

      // Build request body explicitly to avoid issues with spreading
      const requestBody: any = {
        name: formData.name,
        email: formData.email,
        designation: formData.designation || undefined,
        weeklyOff: Array.isArray(formData.weeklyOff) ? formData.weeklyOff : [],
      };

      // Handle role based on permissions
      if (canChangeRole) {
        requestBody.role = formData.role;
      } else {
        requestBody.role = editingEmployee ? editingEmployee.role : 'employee';
      }

      // Handle clockInTime
      // If "no restrictions" is checked, send "N/R" as a special marker
      // Otherwise, send the time value or empty string
      if (noClockInRestrictions) {
        requestBody.clockInTime = 'N/R';
        console.log('[EmployeeManagement] No restrictions selected, sending "N/R"');
      } else if (editingEmployee) {
        // When editing, always include clockInTime
        // Get the value from formData, default to empty string if not set
        const timeValue = formData.clockInTime ? String(formData.clockInTime).trim() : '';
        requestBody.clockInTime = timeValue; // Always include, even if empty
        console.log('[EmployeeManagement] clockInTime value for edit:', timeValue, 'Length:', timeValue.length, 'Type:', typeof timeValue, 'Original:', formData.clockInTime);
      } else if (formData.clockInTime && formData.clockInTime.trim() !== '') {
        // When creating, only include if it has a value
        requestBody.clockInTime = formData.clockInTime.trim();
      }
      
      // Debug logging
      console.log('[EmployeeManagement] Submitting form data:', formData);
      console.log('[EmployeeManagement] Request body:', requestBody);
      console.log('[EmployeeManagement] weeklyOff being sent:', requestBody.weeklyOff);
      console.log('[EmployeeManagement] clockInTime being sent:', requestBody.clockInTime);

      const cacheBustUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const res = await fetch(cacheBustUrl, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'An error occurred');
        setLoading(false);
        return;
      }

      // Log the response to see what was returned
      console.log('[EmployeeManagement] Update response:', data);
      if (data.user) {
        console.log('[EmployeeManagement] Updated user weeklyOff:', data.user.weeklyOff);
      }

      // Update the employee in the local state immediately with the response data
      if (editingEmployee && data.user) {
        const updatedEmployee = {
          ...data.user,
          weeklyOff: Array.isArray(data.user.weeklyOff) ? data.user.weeklyOff : [],
          clockInTime: data.user.clockInTime || undefined,
        };
        console.log('[EmployeeManagement] Updating local state with:', {
          name: updatedEmployee.name,
          weeklyOff: updatedEmployee.weeklyOff,
          clockInTime: updatedEmployee.clockInTime,
        });
        setEmployees((prevEmployees) =>
          prevEmployees.map((emp) =>
            emp._id === editingEmployee._id ? updatedEmployee : emp
          )
        );
        console.log('[EmployeeManagement] Updated local state with response data');
        console.log('[EmployeeManagement] Updated user clockInTime:', data.user.clockInTime);
      }

      // Refresh employee list to ensure consistency (including weeklyOff)
      try {
        await fetchEmployees();
        console.log('[EmployeeManagement] Employee list refreshed after update');
      } catch (fetchErr) {
        console.error('Error refreshing employee list:', fetchErr);
        // If fetch fails, still show success but log the error
        // The employee should still be updated in the database
      }
      
      if (editingEmployee) {
        toast.success('Employee updated successfully');
      } else {
        toast.success('Employee added successfully');
      }
      
      handleCloseModal();
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const handleDeleteClick = (employee: Employee) => {
    setDeleteModal({ isOpen: true, employee });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.employee) return;

    const id = deleteModal.employee._id;
    setDeleting(true);

    try {
      const res = await fetch(`/api/users/${id}?t=${Date.now()}`, { 
        method: 'DELETE',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();

      if (!res.ok) {
        // Show specific error message from API
        toast.error(data.error || 'Failed to delete employee');
        setDeleting(false);
        setDeleteModal({ isOpen: false, employee: null });
        return;
      }
      
      // Success - remove from UI and show success message
      setEmployees(employees.filter((emp) => emp._id !== id));
      toast.success('Employee deleted successfully');
      
      // Refresh employee list to ensure consistency
      fetchEmployees();
      setDeleting(false);
      setDeleteModal({ isOpen: false, employee: null });
    } catch (err: any) {
      // Network or other errors
      toast.error(err.message || 'An error occurred while deleting employee');
      setDeleting(false);
      setDeleteModal({ isOpen: false, employee: null });
    }
  };

  // Fetch fresh employee data from server
  const fetchEmployees = async () => {
    try {
      const res = await fetch(`/api/users?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json();
      if (res.ok && data.users && Array.isArray(data.users)) {
        // Filter out admin users (API already filters, but double-check for safety)
        // Ensure weeklyOff is always an array and preserve all other fields
        const filteredUsers = data.users
          .filter((u: Employee) => u.role !== 'admin')
          .map((u: Employee) => {
            const weeklyOffArray = Array.isArray(u.weeklyOff) ? u.weeklyOff : [];
            console.log(`[EmployeeManagement] Employee ${u.name} weeklyOff:`, weeklyOffArray, 'clockInTime:', u.clockInTime);
            return {
              ...u,
              weeklyOff: weeklyOffArray,
              clockInTime: u.clockInTime || undefined,
              // Ensure all required fields are present
              emailVerified: u.emailVerified ?? false,
              approved: u.approved ?? false,
            };
          });
        console.log('[EmployeeManagement] Fetched employees with weeklyOff:', filteredUsers.map((u: Employee) => ({ name: u.name, weeklyOff: u.weeklyOff, clockInTime: u.clockInTime })));
        setEmployees(filteredUsers);
      } else {
        console.error('Failed to fetch employees:', data.error || 'Unknown error');
        // Don't clear employees on error, keep existing list
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  // Fetch employees on leave today
  const fetchEmployeesOnLeave = async () => {
    try {
      // Add cache-busting to ensure fresh data
      const res = await fetch('/api/leave/on-leave-today', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json();
      if (res.ok && data.userIdsOnLeave) {
        setEmployeesOnLeaveToday(data.userIdsOnLeave);
      }
    } catch (err) {
      console.error('Error fetching employees on leave:', err);
    }
  };

  // Fetch default clock-in time limit
  const fetchDefaultTimeLimit = async () => {
    if (!isHROrAdmin) return;
    
    try {
      const res = await fetch('/api/settings/clock-in-time-limit');
      const data = await res.json();
      if (res.ok && data.defaultClockInTimeLimit) {
        setDefaultTimeLimit(data.defaultClockInTimeLimit);
      }
    } catch (err) {
      console.error('Error fetching default time limit:', err);
    }
  };

  // Fetch max late days
  const fetchMaxLateDays = async () => {
    if (!isHROrAdmin) return;
    
    try {
      const res = await fetch('/api/settings/max-late-days');
      const data = await res.json();
      if (res.ok && data.maxLateDays !== undefined) {
        setMaxLateDays(data.maxLateDays || 0);
      }
    } catch (err) {
      console.error('Error fetching max late days:', err);
    }
  };

  // Save default clock-in time limit and max late days
  const handleSaveTimeLimit = async () => {
    if (!defaultTimeLimit) {
      toast.error('Please enter a time limit');
      return;
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(defaultTimeLimit)) {
      toast.error('Invalid time format. Please use HH:mm format (e.g., 09:30)');
      return;
    }

    if (maxLateDays < 0) {
      toast.error('Max late days must be 0 or greater');
      return;
    }

    setLoadingTimeLimit(true);
    try {
      // Save time limit
      const timeLimitRes = await fetch('/api/settings/clock-in-time-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeLimit: defaultTimeLimit }),
      });

      const timeLimitData = await timeLimitRes.json();

      if (!timeLimitRes.ok) {
        toast.error(timeLimitData.error || 'Failed to update default time limit');
        setLoadingTimeLimit(false);
        return;
      }

      // Save max late days
      const maxDaysRes = await fetch('/api/settings/max-late-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxLateDays: maxLateDays }),
      });

      const maxDaysData = await maxDaysRes.json();

      if (!maxDaysRes.ok) {
        toast.error(maxDaysData.error || 'Failed to update max late days');
        setLoadingTimeLimit(false);
        return;
      }

      toast.success('Settings updated successfully');
      setShowTimeLimitModal(false);
      setLoadingTimeLimit(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
      setLoadingTimeLimit(false);
    }
  };

  useEffect(() => {
    // Fetch immediately
    fetchEmployeesOnLeave();
    fetchDefaultTimeLimit();
    fetchMaxLateDays();

    // Refresh every 5 seconds to catch status changes quickly
    const interval = setInterval(fetchEmployeesOnLeave, 5000);

    // Refresh when window comes into focus
    const handleFocus = () => {
      fetchEmployeesOnLeave();
    };
    window.addEventListener('focus', handleFocus);

    // Listen for custom event to refresh immediately when leave status changes
    const handleLeaveStatusChange = () => {
      // Clear state first, then fetch fresh data
      setEmployeesOnLeaveToday([]);
      // Small delay to ensure database is updated
      setTimeout(() => {
        fetchEmployeesOnLeave();
      }, 200);
    };
    window.addEventListener('leaveStatusChanged', handleLeaveStatusChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('leaveStatusChanged', handleLeaveStatusChange);
    };
  }, [isHROrAdmin]);

  // Get unique designations from employees
  const uniqueDesignations = useMemo(() => {
    const designations = employees
      .map((emp) => emp.designation)
      .filter((des): des is string => Boolean(des && des.trim() !== ''))
      .sort();
    return Array.from(new Set(designations));
  }, [employees]);

  // Get count for each designation
  const designationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((emp) => {
      if (emp.designation && emp.designation.trim() !== '') {
        counts[emp.designation] = (counts[emp.designation] || 0) + 1;
      }
    });
    return counts;
  }, [employees]);

  // Filter employees based on search term and designation filter
  const filteredEmployees = useMemo(() => {
    let filtered = employees;

    // Apply designation filter
    if (designationFilter) {
      filtered = filtered.filter((employee) => employee.designation === designationFilter);
    }

    // Apply search term filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((employee) => {
        const nameMatch = employee.name.toLowerCase().includes(searchLower);
        const emailMatch = employee.email.toLowerCase().includes(searchLower);
        const designationMatch = employee.designation?.toLowerCase().includes(searchLower);
        const roleMatch = employee.role.toLowerCase().includes(searchLower);
        return nameMatch || emailMatch || designationMatch || roleMatch;
      });
    }

    return filtered;
  }, [employees, searchTerm, designationFilter]);

  // Pagination logic
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredEmployees.slice(startIndex, endIndex);
  }, [filteredEmployees, currentPage]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  // Handle search with page reset
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  };

  // Handle designation filter change
  const handleDesignationFilterChange = (value: string) => {
    setDesignationFilter(value);
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  };

  return (
    <div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-primary font-semibold text-gray-800">All Employees</h2>
            <div className="flex items-center gap-2">
            {isHROrAdmin && (
              <>
                <button
                  onClick={() => {
                    fetchMaxLateDays();
                    setShowTimeLimitModal(true);
                  }}
                  className="group relative flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:from-orange-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg text-xs font-medium"
                  title="Set maximum allowed late arrival days before casual leave deduction"
                >
                  <Calendar className="w-3 h-3" />
                  <span className="font-secondary">Max Days</span>
                  {maxLateDays > 0 ? (
                    <div className="flex items-center gap-1 pl-2 border-l border-white/30">
                      <span className="font-semibold text-sm">{maxLateDays}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 pl-2 border-l border-white/30">
                      <span className="text-xs opacity-80 font-secondary">Not set</span>
                    </div>
                  )}
                </button>
                <button
                  onClick={() => {
                    fetchDefaultTimeLimit();
                    fetchMaxLateDays();
                    setShowTimeLimitModal(true);
                  }}
                  className="group relative flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg text-xs font-medium"
                  title="Set default clock-in time limit for all employees"
                >
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  <span className="font-secondary">Max Time</span>
                </div>
                {defaultTimeLimit ? (
                  <div className="flex items-center gap-1.5 pl-2.5 border-l border-white/30">
                    <span className="font-semibold text-sm">{formatTimeString12Hour(defaultTimeLimit)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 pl-2.5 border-l border-white/30">
                    <span className="text-xs opacity-80 font-secondary">Not set</span>
                  </div>
                )}
              </button>
              </>
            )}
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="font-secondary">Add Employee</span>
            </button>
          </div>
          </div>
          {/* Search Box */}
          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search employees by name, email, designation, or role..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2 text-sm text-gray-700  rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-gray-100"
              />
              {searchTerm && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Designation Filter Tabs */}
          {uniqueDesignations.length > 0 && (
            <div className="mt-3 pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500 font-secondary">Filter by:</span>
                <button
                  onClick={() => handleDesignationFilterChange('')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    !designationFilter
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>All</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    !designationFilter
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {employees.length}
                  </span>
                </button>
                {uniqueDesignations.map((designation) => (
                  <button
                    key={designation}
                    onClick={() => handleDesignationFilterChange(designation)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                      designationFilter === designation
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>{designation}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      designationFilter === designation
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {designationCounts[designation] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Name
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  EMP ID
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Email
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Role
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Designation
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Week Off
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Clockin Time
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Email
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedEmployees.map((employee) => (
                <motion.tr
                  key={employee._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        name={employee.name}
                        image={employee.profileImage}
                        size="sm"
                      />
                      <div className="flex items-center gap-1.5">
                        <div className="text-xs font-medium text-gray-900 font-secondary">{employee.name}</div>
                        {employeesOnLeaveToday.includes(employee._id) && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-orange-100 text-orange-800 flex items-center gap-0.5 font-secondary">
                            <Calendar className="w-2.5 h-2.5" />
                            On Leave
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-xs font-semibold text-gray-900 font-secondary">
                      {employee.empId || <span className="text-gray-400 italic font-normal">Not set</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-xs text-gray-900 font-secondary">{employee.email}</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="px-1.5 py-0.5 inline-flex text-[10px] leading-4 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize font-secondary">
                      {employee.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-xs text-gray-900 font-secondary">
                      {employee.designation || <span className="text-gray-400 italic">Not set</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        const weeklyOffArray = Array.isArray(employee.weeklyOff) ? employee.weeklyOff : [];
                        console.log(`[Display] Employee ${employee.name} weeklyOff:`, weeklyOffArray, 'Type:', typeof employee.weeklyOff);
                        if (weeklyOffArray.length > 0) {
                          return weeklyOffArray.map((day: string) => (
                            <span
                              key={day}
                              className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-700 font-secondary whitespace-nowrap"
                              title={day}
                            >
                              {day.substring(0, 3)}
                            </span>
                          ));
                        } else {
                          return <span className="text-[10px] text-gray-400 italic font-secondary">Not set</span>;
                        }
                      })()}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {employee.clockInTime === 'N/R' ? (
                        <span className="px-1.5 py-0.5 inline-flex items-center gap-0.5 text-[10px] leading-4 font-semibold rounded-full bg-green-100 text-green-800 font-secondary">
                          N/R
                        </span>
                      ) : employee.clockInTime && employee.clockInTime.trim() !== '' ? (
                        <span className="px-1.5 py-0.5 inline-flex items-center gap-0.5 text-[10px] leading-4 font-semibold rounded-full bg-blue-100 text-blue-800 font-secondary">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimeString12Hour(employee.clockInTime)}
                        </span>
                      ) : defaultTimeLimit ? (
                        <span className="px-1.5 py-0.5 inline-flex items-center gap-0.5 text-[10px] leading-4 font-semibold rounded-full bg-gray-100 text-gray-700 font-secondary">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimeString12Hour(defaultTimeLimit)} <span className="text-gray-500 text-[9px]">(Def)</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic font-secondary">Not set</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`px-1.5 py-0.5 inline-flex text-[10px] leading-4 font-semibold rounded-full font-secondary ${
                        employee.emailVerified
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {employee.emailVerified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`px-1.5 py-0.5 inline-flex text-[10px] leading-4 font-semibold rounded-full font-secondary ${
                        employee.approved === true
                          ? 'bg-green-100 text-green-800'
                          : employee.emailVerified
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {employee.approved === true
                        ? 'Approved'
                        : employee.emailVerified
                        ? 'Pending Approval'
                        : 'Not Verified'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-medium">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenModal(employee)}
                        className="text-primary hover:text-primary-dark p-0.5 rounded hover:bg-primary-50"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(employee)}
                        className="text-red-600 hover:text-red-900 p-0.5 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
            totalItems={filteredEmployees.length}
            itemsPerPage={itemsPerPage}
          />
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl p-4 w-full max-w-sm border border-white/50 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-primary font-bold text-gray-800 mb-3">
              {editingEmployee ? 'Edit Employee' : 'Add Employee'}
            </h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs mb-3">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 font-secondary">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-2.5 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 font-secondary">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!editingEmployee}
                  className="w-full px-2.5 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-100 disabled:text-gray-500 font-secondary bg-white"
                />
              </div>

              {canChangeRole ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-secondary">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value as any })
                    }
                    required
                    className="w-full px-2.5 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                  >
                    <option value="employee">Employee</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-secondary">Role</label>
                  <div className="w-full px-2.5 py-1.5 text-sm text-gray-500 border border-gray-300 rounded-lg bg-gray-100 font-secondary capitalize">
                    {formData.role}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 font-secondary">Role cannot be changed</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 font-secondary">Designation</label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="e.g., Software Engineer, HR Manager, etc."
                  className="w-full px-2.5 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 font-secondary">Weekly Off</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                    <label
                      key={day}
                      className="flex items-center gap-1.5 px-2 py-1.5 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.weeklyOff.includes(day)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, weeklyOff: [...formData.weeklyOff, day] });
                          } else {
                            setFormData({ ...formData, weeklyOff: formData.weeklyOff.filter(d => d !== day) });
                          }
                        }}
                        className="w-3.5 h-3.5 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-xs text-gray-700 font-secondary">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              {isHROrAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-secondary">
                    Clock-in Time <span className="text-gray-400 text-[10px]">(Optional)</span>
                  </label>
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={noClockInRestrictions}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNoClockInRestrictions(checked);
                          if (checked) {
                            setFormData({ ...formData, clockInTime: '' });
                          }
                        }}
                        className="w-3.5 h-3.5 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-xs text-gray-700 font-secondary">No restrictions</span>
                    </label>
                  </div>
                  <input
                    type="time"
                    value={formData.clockInTime || ''}
                    onChange={(e) => {
                      const timeValue = e.target.value;
                      console.log('[EmployeeManagement] Clock-in time changed to:', timeValue);
                      setFormData({ ...formData, clockInTime: timeValue });
                      if (timeValue && timeValue.trim() !== '') {
                        setNoClockInRestrictions(false);
                      }
                    }}
                    disabled={noClockInRestrictions}
                    placeholder="09:30"
                    className="w-full px-2.5 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                  />
                  <p className="mt-0.5 text-[10px] text-gray-500 font-secondary">
                    {noClockInRestrictions 
                      ? 'No clock-in time restrictions' 
                      : 'Leave empty to use default time limit'}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 font-secondary flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <LoadingDots size="sm" color="white" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    editingEmployee ? 'Update' : 'Add'
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
        onClose={() => setDeleteModal({ isOpen: false, employee: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Employee"
        message="Are you sure you want to delete this employee?"
        details={
          deleteModal.employee ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Name</span>
                <span className="text-sm font-semibold text-gray-900">{deleteModal.employee.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Email</span>
                <span className="text-sm font-semibold text-gray-900 truncate ml-2">{deleteModal.employee.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Role</span>
                <span className="text-sm font-semibold text-gray-900 capitalize">{deleteModal.employee.role}</span>
              </div>
              {deleteModal.employee.designation && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Designation</span>
                  <span className="text-sm font-semibold text-gray-900">{deleteModal.employee.designation}</span>
                </div>
              )}
            </div>
          ) : null
        }
        loading={deleting}
      />

      {/* Default Time Limit Modal */}
      {showTimeLimitModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/95 backdrop-blur-xl rounded-md shadow-2xl p-5 w-full max-w-md border border-white/50"
          >
            <h2 className="text-xl font-primary font-bold text-gray-800 mb-4">
              Clock-in Settings
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
                  Max Late Days
                </label>
                <input
                  type="number"
                  min="0"
                  value={maxLateDays}
                  onChange={(e) => setMaxLateDays(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-gray-500 font-secondary">
                  Maximum allowed late arrival days before deducting 0.5 casual leave (e.g., 3 days)
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
                  Time Limit (HH:mm)
                </label>
                <input
                  type="time"
                  value={defaultTimeLimit}
                  onChange={(e) => setDefaultTimeLimit(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                  placeholder="09:30"
                />
                <p className="mt-1 text-xs text-gray-500 font-secondary">
                  Set the default clock-in time limit for all employees (e.g., 09:30)
                </p>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowTimeLimitModal(false);
                    setDefaultTimeLimit('');
                    setMaxLateDays(0);
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTimeLimit}
                  disabled={loadingTimeLimit}
                  className="flex-1 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 font-secondary flex items-center justify-center gap-2"
                >
                  {loadingTimeLimit ? (
                    <>
                      <LoadingDots size="sm" color="white" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

