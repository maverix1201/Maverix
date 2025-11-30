'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Plus,
  Calendar,
  TrendingUp,
  X,
  Search,
  User,
  Check,
  ChevronDown,
  FileText,
  Wallet,
  CreditCard,
  Building2,
  Edit,
  Trash2,
  IndianRupee,
} from 'lucide-react';
import { format } from 'date-fns';
import UserAvatar from './UserAvatar';
import { useToast } from '@/contexts/ToastContext';
import LoadingDots from './LoadingDots';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface Finance {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
  };
  month: number;
  year: number;
  baseSalary: number;
  totalSalary: number;
}

interface Employee {
  _id: string;
  name: string;
  email: string;
  profileImage?: string;
}

interface FinanceManagementProps {
  initialFinances: Finance[];
  canEdit: boolean;
}

export default function FinanceManagement({
  initialFinances,
  canEdit,
}: FinanceManagementProps) {
  const [finances, setFinances] = useState<Finance[]>(initialFinances);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingFinance, setEditingFinance] = useState<Finance | null>(null);
  const [deletingFinance, setDeletingFinance] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    userId: '',
    baseSalary: '',
  });

  const [editFormData, setEditFormData] = useState({
    baseSalary: '',
    month: '',
    year: '',
  });

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  }, []);

  useEffect(() => {
    if (canEdit) {
      fetchEmployees();
    }
  }, [canEdit, fetchEmployees]);

  // Close employee dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        employeeDropdownRef.current &&
        !employeeDropdownRef.current.contains(event.target as Node)
      ) {
        setEmployeeDropdownOpen(false);
      }
    };

    if (employeeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [employeeDropdownOpen]);

  const getMonthName = (month: number) => {
    return format(new Date(2000, month - 1, 1), 'MMMM');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleOpenModal = () => {
    setFormData({
      userId: '',
      baseSalary: '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEmployeeDropdownOpen(false);
    setEmployeeSearchTerm('');
  };

  const handleOpenEditModal = (finance: Finance) => {
    setEditingFinance(finance);
    setEditFormData({
      baseSalary: finance.baseSalary.toString(),
      month: finance.month.toString(),
      year: finance.year.toString(),
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingFinance(null);
    setEditFormData({
      baseSalary: '',
      month: '',
      year: '',
    });
  };

  const handleOpenDeleteModal = (finance: Finance) => {
    setDeletingFinance(finance);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingFinance(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const currentDate = new Date();
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: formData.userId,
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          baseSalary: parseFloat(formData.baseSalary),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to allocate salary');
        setLoading(false);
        return;
      }

      toast.success('Salary allocated successfully');
      handleCloseModal();

      // Refresh finances
      const refreshRes = await fetch('/api/finance');
      const refreshData = await refreshRes.json();
      if (refreshRes.ok) {
        setFinances(refreshData.finances || []);
      }
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFinance) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/finance/${editingFinance._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseSalary: parseFloat(editFormData.baseSalary),
          month: parseInt(editFormData.month),
          year: parseInt(editFormData.year),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to update salary');
        setLoading(false);
        return;
      }

      toast.success('Salary updated successfully');
      handleCloseEditModal();

      // Refresh finances
      const refreshRes = await fetch('/api/finance');
      const refreshData = await refreshRes.json();
      if (refreshRes.ok) {
        setFinances(refreshData.finances || []);
      }
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingFinance) return;

    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/finance/${deletingFinance._id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to delete salary record');
        setDeleteLoading(false);
        return;
      }

      toast.success('Salary record deleted successfully');
      handleCloseDeleteModal();

      // Refresh finances
      const refreshRes = await fetch('/api/finance');
      const refreshData = await refreshRes.json();
      if (refreshRes.ok) {
        setFinances(refreshData.finances || []);
      }
      setDeleteLoading(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
      setDeleteLoading(false);
    }
  };

  const selectedEmployee = employees.find((emp) => emp._id === formData.userId);
  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  const filteredFinances = finances.filter((finance) => {
    if (!canEdit) return true; // Employee view shows all their finances
    const searchLower = searchTerm.toLowerCase();
    return (
      finance.userId.name.toLowerCase().includes(searchLower) ||
      finance.userId.email.toLowerCase().includes(searchLower) ||
      getMonthName(finance.month).toLowerCase().includes(searchLower)
    );
  });

  // Calculate stats
  const totalSalary = filteredFinances.reduce((sum, f) => sum + f.totalSalary, 0);
  const totalEmployees = filteredFinances.length;
  const averageSalary = totalEmployees > 0 ? totalSalary / totalEmployees : 0;

  return (
    <>
      <div className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-secondary mb-1">Total Salary Allocated</p>
                <p className="text-3xl font-primary font-bold text-gray-800">{formatCurrency(totalSalary)}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-xl shadow-lg">
                <Wallet className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-secondary mb-1">Total Employees</p>
                <p className="text-3xl font-primary font-bold text-gray-800">{totalEmployees}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
                <User className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-secondary mb-1">Average Salary</p>
                <p className="text-3xl font-primary font-bold text-gray-800">{formatCurrency(averageSalary)}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-3 rounded-xl shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Header with Search and Add Button */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-primary font-bold text-gray-800">
                {canEdit ? 'Salary Management' : 'My Salary History'}
              </h2>
              <p className="text-xs text-gray-600 mt-1 font-secondary">
                {canEdit
                  ? 'Manage and allocate employee salaries'
                  : 'View your salary information and payslips'}
              </p>
            </div>
            {canEdit && (
              <div className="flex gap-3">
                <div className="relative flex-1 md:flex-initial">
                  <Search className="absolute z-10 left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 text-sm border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm w-full md:w-64"
                  />
                </div>
                <button
                  onClick={handleOpenModal}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-secondary text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Allocate Salary
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Finance Records */}
        {filteredFinances.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-8 text-center">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-secondary">
              {searchTerm ? 'No records found' : 'No salary records yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {filteredFinances.map((finance, index) => (
              <motion.div
                key={finance._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-5 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={finance.userId.name}
                      image={finance.userId.profileImage}
                      size="sm"
                    />
                    <div>
                      <div className="font-semibold text-gray-900 font-primary text-sm">
                        {finance.userId.name}
                      </div>
                      {canEdit && (
                        <div className="text-xs text-gray-500 font-secondary">{finance.userId.email}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(finance)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(finance)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-gray-700 font-primary">Salary</span>
                    <span className="text-xl font-bold text-primary font-primary">
                      {formatCurrency(finance.baseSalary)}
                    </span>
                  </div>

                  {/* Bank Details */}
                  {canEdit && (
                    <div className="mt-3 pt-3 bg-blue-300/10 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <CreditCard className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-semibold text-gray-600 font-primary">Bank Details</span>
                      </div>
                      {finance.userId.accountNumber ? (
                        <div className="space-y-2">
                          {finance.userId.bankName && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-500 font-secondary">Bank:</span>
                              <span className="font-medium text-gray-900 font-secondary">{finance.userId.bankName}</span>
                            </div>
                          )}
                          {finance.userId.accountNumber && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-500 font-secondary">Account:</span>
                              <span className="font-medium text-gray-900 font-secondary">{finance.userId.accountNumber}</span>
                            </div>
                          )}
                          {finance.userId.ifscCode && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-500 font-secondary">IFSC:</span>
                              <span className="font-medium text-gray-900 font-secondary">{finance.userId.ifscCode}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 font-secondary">
                          No bank details added yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Allocate Salary Modal */}
      {canEdit && (
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-primary font-bold text-gray-800">
                    Allocate Salary
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Employee Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-secondary">
                      Employee *
                    </label>
                    <div className="relative" ref={employeeDropdownRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setEmployeeDropdownOpen(!employeeDropdownOpen);
                          setEmployeeSearchTerm('');
                        }}
                        className={`w-full px-3 py-2 text-sm text-left border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm shadow-sm transition-all flex items-center justify-between ${formData.userId
                            ? 'border-primary/30 text-gray-700'
                            : 'border-gray-300/50 text-gray-500'
                          }`}
                      >
                        {selectedEmployee ? (
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              name={selectedEmployee.name}
                              image={selectedEmployee.profileImage}
                              size="sm"
                            />
                            <div className="flex flex-col">
                              <span className="text-gray-900 font-medium">{selectedEmployee.name}</span>
                              <span className="text-xs text-gray-500">{selectedEmployee.email}</span>
                            </div>
                          </div>
                        ) : (
                          <span>Select Employee</span>
                        )}
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 transition-transform ${employeeDropdownOpen ? 'transform rotate-180' : ''
                            }`}
                        />
                      </button>

                      <AnimatePresence>
                        {employeeDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-xl rounded-lg shadow-2xl border border-white/50 overflow-hidden"
                          >
                            <div className="p-2 border-b border-gray-200/50">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                <input
                                  type="text"
                                  value={employeeSearchTerm}
                                  onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                                  placeholder="Search employees..."
                                  className="w-full pl-9 pr-3 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>

                            <div className="max-h-60 overflow-y-auto">
                              {filteredEmployees.length === 0 ? (
                                <div className="p-3 text-center text-xs text-gray-500">
                                  No employees found
                                </div>
                              ) : (
                                filteredEmployees.map((emp) => (
                                  <button
                                    key={emp._id}
                                    type="button"
                                    onClick={() => {
                                      setFormData({ ...formData, userId: emp._id });
                                      setEmployeeDropdownOpen(false);
                                      setEmployeeSearchTerm('');
                                    }}
                                    className={`w-full px-3 py-2 flex items-center gap-2.5 hover:bg-primary/5 transition-colors ${formData.userId === emp._id ? 'bg-primary/10' : ''
                                      }`}
                                  >
                                    <UserAvatar
                                      name={emp.name}
                                      image={emp.profileImage}
                                      size="sm"
                                    />
                                    <div className="flex-1 text-left">
                                      <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                                      <div className="text-xs text-gray-500">{emp.email}</div>
                                    </div>
                                    {formData.userId === emp._id && (
                                      <Check className="w-3.5 h-3.5 text-primary" />
                                    )}
                                  </button>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Base Salary */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-secondary">
                      Salary (INR) *
                    </label>
                    <div className="relative">
                      <IndianRupee className="absolute z-10 left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="number"
                        step="1"
                        value={formData.baseSalary}
                        onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                        required
                        placeholder="0"
                        className="w-full pl-10 pr-3 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Salary Preview */}
                  <div className="bg-gradient-to-r from-primary/10 to-purple-600/10 rounded-lg p-3 border border-primary/20">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-900 font-primary">
                        Salary
                      </span>
                      <span className="text-xl font-bold text-primary font-primary">
                        {formatCurrency(parseFloat(formData.baseSalary) || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="flex-1 px-4 py-2 text-sm border border-gray-300/50 rounded-lg text-gray-700 hover:bg-gray-50/80 transition-all font-secondary backdrop-blur-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !formData.userId}
                      className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 font-secondary flex items-center justify-center gap-2 backdrop-blur-sm"
                    >
                      {loading ? (
                        <>
                          <LoadingDots size="sm" color="white" />
                          <span>Allocating...</span>
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-3.5 h-3.5" />
                          Allocate Salary
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      )}

      {/* Edit Salary Modal */}
      {canEdit && (
        <AnimatePresence>
          {showEditModal && editingFinance && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-primary font-bold text-gray-800">
                    Edit Salary
                  </h2>
                  <button
                    onClick={handleCloseEditModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleEditSubmit} className="space-y-4">
                  {/* Employee Info (Read-only) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-secondary">
                      Employee
                    </label>
                    <div className="px-3 py-2 text-sm border border-gray-300/50 rounded-lg bg-gray-50/80 font-secondary flex items-center gap-3">
                      <UserAvatar
                        name={editingFinance.userId.name}
                        image={editingFinance.userId.profileImage}
                        size="sm"
                      />
                      <div>
                        <div className="text-gray-900 font-medium">{editingFinance.userId.name}</div>
                        <div className="text-xs text-gray-500">{editingFinance.userId.email}</div>
                      </div>
                    </div>
                  </div>

                  {/* Month */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-secondary">
                      Month *
                    </label>
                    <select
                      value={editFormData.month}
                      onChange={(e) => setEditFormData({ ...editFormData, month: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm shadow-sm"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <option key={month} value={month}>
                          {getMonthName(month)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Year */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-secondary">
                      Year *
                    </label>
                    <input
                      type="number"
                      value={editFormData.year}
                      onChange={(e) => setEditFormData({ ...editFormData, year: e.target.value })}
                      required
                      min="2000"
                      max="2100"
                      placeholder="2024"
                      className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm shadow-sm"
                    />
                  </div>

                  {/* Base Salary */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-secondary">
                      Salary (INR) *
                    </label>
                    <div className="relative">
                      <IndianRupee className="absolute z-10 left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="number"
                        step="1"
                        value={editFormData.baseSalary}
                        onChange={(e) => setEditFormData({ ...editFormData, baseSalary: e.target.value })}
                        required
                        placeholder="0"
                        className="w-full pl-10 pr-3 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Salary Preview */}
                  <div className="bg-gradient-to-r from-primary/10 to-purple-600/10 rounded-lg p-3 border border-primary/20">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-900 font-primary">
                        Salary
                      </span>
                      <span className="text-xl font-bold text-primary font-primary">
                        {formatCurrency(parseFloat(editFormData.baseSalary) || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3">
                    <button
                      type="button"
                      onClick={handleCloseEditModal}
                      className="flex-1 px-4 py-2 text-sm border border-gray-300/50 rounded-lg text-gray-700 hover:bg-gray-50/80 transition-all font-secondary backdrop-blur-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 font-secondary flex items-center justify-center gap-2 backdrop-blur-sm"
                    >
                      {loading ? (
                        <>
                          <LoadingDots size="sm" color="white" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Edit className="w-3.5 h-3.5" />
                          Update Salary
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      )}

      {/* Delete Confirmation Modal */}
      {canEdit && deletingFinance && (
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={handleCloseDeleteModal}
          onConfirm={handleDelete}
          title="Delete Salary Record"
          message="Are you sure you want to delete this salary record? This action cannot be undone."
          details={
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Employee:</span>
                <span className="font-medium text-gray-900">{deletingFinance.userId.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Period:</span>
                <span className="font-medium text-gray-900">
                  {getMonthName(deletingFinance.month)} {deletingFinance.year}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Salary:</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(deletingFinance.baseSalary)}
                </span>
              </div>
            </div>
          }
          loading={deleteLoading}
        />
      )}
    </>
  );
}
