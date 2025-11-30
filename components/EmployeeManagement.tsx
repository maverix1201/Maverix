'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Mail, User, Calendar } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';
import Pagination from './Pagination';

interface Employee {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'hr' | 'employee';
  designation?: string;
  emailVerified: boolean;
  approved?: boolean;
  profileImage?: string;
  createdAt?: string;
}

interface EmployeeManagementProps {
  initialEmployees: Employee[];
  canChangeRole?: boolean;
}

export default function EmployeeManagement({ initialEmployees, canChangeRole = true }: EmployeeManagementProps) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'employee' as 'admin' | 'hr' | 'employee',
    designation: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; employee: Employee | null }>({
    isOpen: false,
    employee: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [employeesOnLeaveToday, setEmployeesOnLeaveToday] = useState<string[]>([]);
  const toast = useToast();

  const handleOpenModal = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        name: employee.name,
        email: employee.email,
        role: employee.role,
        designation: employee.designation || '',
      });
    } else {
      setEditingEmployee(null);
      setFormData({ name: '', email: '', role: 'employee', designation: '' });
    }
    setShowModal(true);
    setError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
    setFormData({ name: '', email: '', role: 'employee', designation: '' });
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

      // Don't send role if HR cannot change roles
      const requestBody = canChangeRole 
        ? formData 
        : { ...formData, role: editingEmployee ? editingEmployee.role : 'employee' };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'An error occurred');
        setLoading(false);
        return;
      }

      if (editingEmployee) {
        setEmployees(
          employees.map((emp) => (emp._id === editingEmployee._id ? data.user : emp))
        );
        toast.success('Employee updated successfully');
      } else {
        setEmployees([...employees, data.user]);
        toast.success('Employee added successfully');
      }

      // Refresh employee list to ensure consistency
      fetchEmployees();
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

    // Optimistic update - remove immediately from UI
    const previousEmployees = [...employees];
    setEmployees(employees.filter((emp) => emp._id !== id));
    toast.success('Employee deleted successfully');

    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });

      if (!res.ok) {
        // Revert on error
        setEmployees(previousEmployees);
        toast.error('Failed to delete employee');
        setDeleting(false);
        setDeleteModal({ isOpen: false, employee: null });
        return;
      }
      
      // Refresh employee list to ensure consistency
      fetchEmployees();
      setDeleting(false);
      setDeleteModal({ isOpen: false, employee: null });
    } catch (err) {
      // Revert on error
      setEmployees(previousEmployees);
      toast.error('An error occurred');
      setDeleting(false);
      setDeleteModal({ isOpen: false, employee: null });
    }
  };

  // Fetch fresh employee data from server
  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/users', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json();
      if (res.ok && data.users) {
        // Filter out admin users if needed (same as initial filter)
        const filteredUsers = data.users.filter((u: Employee) => u.role !== 'admin');
        setEmployees(filteredUsers);
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

  useEffect(() => {
    // Fetch immediately
    fetchEmployeesOnLeave();

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
  }, []);

  // Pagination logic
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return employees.slice(startIndex, endIndex);
  }, [employees, currentPage]);

  const totalPages = Math.ceil(employees.length / itemsPerPage);

  return (
    <div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-primary font-semibold text-gray-800">All Employees</h2>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="font-secondary">Add Employee</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Name
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Email
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Role
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Designation
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Email Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
                  Approval Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-primary">
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={employee.name}
                        image={employee.profileImage}
                        size="md"
                      />
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900 font-secondary">{employee.name}</div>
                        {employeesOnLeaveToday.includes(employee._id) && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 flex items-center gap-1 font-secondary">
                            <Calendar className="w-3 h-3" />
                            On Leave Today
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-secondary">{employee.email}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize font-secondary">
                      {employee.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-secondary">
                      {employee.designation || <span className="text-gray-400 italic">Not set</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full font-secondary ${
                        employee.emailVerified
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {employee.emailVerified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full font-secondary ${
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
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenModal(employee)}
                        className="text-primary hover:text-primary-dark p-1 rounded hover:bg-primary-50"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(employee)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
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
            totalItems={employees.length}
            itemsPerPage={itemsPerPage}
          />
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl p-5 w-full max-w-md"
          >
            <h2 className="text-xl font-primary font-bold text-gray-800 mb-4">
              {editingEmployee ? 'Edit Employee' : 'Add Employee'}
            </h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!editingEmployee}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-100 disabled:text-gray-500 font-secondary bg-white"
                />
              </div>

              {canChangeRole ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value as any })
                    }
                    required
                    className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                  >
                    <option value="employee">Employee</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">Role</label>
                  <div className="w-full px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg bg-gray-100 font-secondary capitalize">
                    {formData.role}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 font-secondary">Role cannot be changed</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">Designation</label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="e.g., Software Engineer, HR Manager, etc."
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
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
            <div className="space-y-1">
              <div>
                <span className="font-semibold">Name:</span> {deleteModal.employee.name}
              </div>
              <div>
                <span className="font-semibold">Email:</span> {deleteModal.employee.email}
              </div>
              <div>
                <span className="font-semibold">Role:</span> {deleteModal.employee.role}
              </div>
              {deleteModal.employee.designation && (
                <div>
                  <span className="font-semibold">Designation:</span> {deleteModal.employee.designation}
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

