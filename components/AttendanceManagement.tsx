'use client';

import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import UserAvatar from './UserAvatar';
import Pagination from './Pagination';
import AdvancedFilterBar from './AdvancedFilterBar';

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

    const filtered = initialAttendance.filter((attendance) => {
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

    // Sort by date (newest first) to group dates together
    return filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
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

  const hasActiveFilters = !!(
    filterEmployee !== 'all' ||
    filterStatus !== 'all' ||
    filterDateFrom ||
    filterDateTo ||
    filterClockOut !== 'all' ||
    searchTerm
  );

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
      {/* Advanced Filter Bar */}
      <AdvancedFilterBar
        searchPlaceholder="Search by employee name or email..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        hasActiveFilters={hasActiveFilters}
        onClearAll={clearFilters}
        resultsCount={filteredAttendance.length}
        totalCount={initialAttendance.length}
        filters={[
          ...(showEmployeeColumn
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
          {
            label: 'Status',
            key: 'status',
            type: 'select' as const,
            value: filterStatus,
            onChange: setFilterStatus,
            options: [
              { value: 'all', label: 'All Status' },
              { value: 'present', label: 'Present' },
              { value: 'absent', label: 'Absent' },
              { value: 'half-day', label: 'Half Day' },
              { value: 'leave', label: 'Leave' },
            ],
          },
          {
            label: 'Clock Out',
            key: 'clockOut',
            type: 'select' as const,
            value: filterClockOut,
            onChange: setFilterClockOut,
            options: [
              { value: 'all', label: 'All' },
              { value: 'yes', label: 'Clocked Out' },
              { value: 'no', label: 'Not Clocked Out' },
            ],
          },
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
                paginatedAttendance.map((attendance, index) => {
                  // Check if this is the first row or if the date has changed
                  const prevAttendance = index > 0 ? paginatedAttendance[index - 1] : null;
                  const currentDate = new Date(attendance.date).toDateString();
                  const prevDate = prevAttendance ? new Date(prevAttendance.date).toDateString() : null;
                  const shouldShowSeparator = prevDate && currentDate !== prevDate;

                  return (
                    <>
                      {shouldShowSeparator && (
                        <tr key={`separator-${attendance._id}`}>
                          <td
                            colSpan={showEmployeeColumn ? 6 : 5}
                            className="px-4 py-2 bg-gray-100"
                          >
                            <div className="text-sm font-semibold text-gray-700 font-secondary">
                              {formatDate(attendance.date)}
                            </div>
                          </td>
                        </tr>
                      )}
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
                          {attendance.clockOut ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full font-secondary bg-green-100 text-green-800">
                              Completed
                            </span>
                          ) : attendance.clockIn ? (() => {
                            const attendanceDate = new Date(attendance.date);
                            attendanceDate.setHours(0, 0, 0, 0);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const isDatePassed = attendanceDate < today;
                            
                            return isDatePassed ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full font-secondary bg-red-100 text-red-800">
                                Not clocked out
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full font-secondary bg-blue-100 text-blue-800">
                                Working
                              </span>
                            );
                          })() : (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full font-secondary bg-red-100 text-red-800">
                              Not clocked out
                            </span>
                          )}
                        </td>
                      </tr>
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
            totalItems={filteredAttendance.length}
            itemsPerPage={itemsPerPage}
          />
        )}
      </div>
    </div>
  );
}

