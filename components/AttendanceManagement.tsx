'use client';

import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock, Search, Filter, X } from 'lucide-react';
import { motion } from 'framer-motion';
import UserAvatar from './UserAvatar';
import Pagination from './Pagination';

interface Attendance {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
  };
  date: string;
  clockIn: string;
  clockOut?: string;
  status: string;
  hoursWorked?: number;
}

interface AttendanceManagementProps {
  initialAttendance: Attendance[];
}

export default function AttendanceManagement({ initialAttendance }: AttendanceManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterClockOut, setFilterClockOut] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'hh:mm a');
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  // Get unique employees for filter dropdown
  const employees = useMemo(() => {
    if (!initialAttendance || initialAttendance.length === 0) return [];
    const uniqueEmployees = new Map();
    initialAttendance.forEach((att) => {
      if (att.userId) {
        uniqueEmployees.set(att.userId._id, att.userId);
      }
    });
    return Array.from(uniqueEmployees.values());
  }, [initialAttendance]);

  // Filter and search logic
  const filteredAttendance = useMemo(() => {
    if (!initialAttendance || initialAttendance.length === 0) return [];

    return initialAttendance.filter((attendance) => {
      // Search filter - search in employee name, email
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          attendance.userId?.name?.toLowerCase().includes(searchLower) ||
          attendance.userId?.email?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Employee filter
      if (filterEmployee !== 'all' && attendance.userId?._id !== filterEmployee) {
        return false;
      }

      // Status filter
      if (filterStatus !== 'all' && attendance.status !== filterStatus) {
        return false;
      }

      // Clock out filter
      if (filterClockOut === 'yes' && !attendance.clockOut) {
        return false;
      }
      if (filterClockOut === 'no' && attendance.clockOut) {
        return false;
      }

      // Date range filter
      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom);
        fromDate.setHours(0, 0, 0, 0);
        const attendanceDate = new Date(attendance.date);
        attendanceDate.setHours(0, 0, 0, 0);
        if (attendanceDate < fromDate) return false;
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999);
        const attendanceDate = new Date(attendance.date);
        attendanceDate.setHours(23, 59, 59, 999);
        if (attendanceDate > toDate) return false;
      }

      return true;
    });
  }, [initialAttendance, searchTerm, filterEmployee, filterStatus, filterDateFrom, filterDateTo, filterClockOut]);

  // Pagination logic
  const paginatedAttendance = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAttendance.slice(startIndex, endIndex);
  }, [filteredAttendance, currentPage]);

  const totalPages = Math.ceil(filteredAttendance.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterEmployee, filterStatus, filterDateFrom, filterDateTo, filterClockOut]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterEmployee('all');
    setFilterStatus('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterClockOut('all');
  };

  const hasActiveFilters =
    filterEmployee !== 'all' ||
    filterStatus !== 'all' ||
    filterDateFrom ||
    filterDateTo ||
    filterClockOut !== 'all' ||
    searchTerm;

  if (!initialAttendance || initialAttendance.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center">
        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-secondary">No attendance records found</p>
      </div>
    );
  }

  const showEmployeeColumn = initialAttendance[0]?.userId;

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
              placeholder="Search by employee name or email..."
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
                !
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-gray-200"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Employee Filter */}
              {showEmployeeColumn && (
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

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="half-day">Half Day</option>
                  <option value="leave">Leave</option>
                </select>
              </div>

              {/* Clock Out Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">Clock Out</label>
                <select
                  value={filterClockOut}
                  onChange={(e) => setFilterClockOut(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                >
                  <option value="all">All</option>
                  <option value="yes">Clocked Out</option>
                  <option value="no">Not Clocked Out</option>
                </select>
              </div>

              {/* Date From Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">Date From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                />
              </div>

              {/* Date To Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">Date To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                />
              </div>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-secondary"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {showEmployeeColumn && (
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                    Employee
                  </th>
                )}
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                  Date
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                  Clock In
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                  Clock Out
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                  Hours
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase font-primary">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedAttendance.length === 0 ? (
                <tr>
                  <td
                    colSpan={showEmployeeColumn ? 6 : 5}
                    className="px-4 py-12 text-center text-gray-500 font-secondary"
                  >
                    No attendance records found matching your filters
                  </td>
                </tr>
              ) : (
                paginatedAttendance.map((attendance) => (
                  <tr key={attendance._id} className="hover:bg-gray-50">
                    {showEmployeeColumn && attendance.userId && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={attendance.userId.name}
                            image={attendance.userId.profileImage}
                            size="md"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900 font-secondary">
                              {attendance.userId.name}
                            </div>
                            <div className="text-xs text-gray-500 font-secondary">{attendance.userId.email}</div>
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-secondary">{formatDate(attendance.date)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-sm text-gray-900 font-secondary">
                        <Clock className="w-3.5 h-3.5 text-green-600" />
                        {formatTime(attendance.clockIn)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {attendance.clockOut ? (
                        <div className="flex items-center gap-1.5 text-sm text-gray-900 font-secondary">
                          <Clock className="w-3.5 h-3.5 text-red-600" />
                          {formatTime(attendance.clockOut)}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 font-secondary">Not clocked out</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-secondary">
                        {attendance.hoursWorked
                          ? `${attendance.hoursWorked.toFixed(2)} hrs`
                          : 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full font-secondary ${
                          attendance.status === 'present'
                            ? 'bg-green-100 text-green-800'
                            : attendance.status === 'absent'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {attendance.status}
                      </span>
                    </td>
                  </tr>
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
            totalItems={filteredAttendance.length}
            itemsPerPage={itemsPerPage}
          />
        )}
      </div>
    </div>
  );
}

