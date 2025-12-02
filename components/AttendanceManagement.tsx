'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { format, startOfDay, isSameDay, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { Clock, Calendar, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';

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

interface Employee {
  _id: string;
  name: string;
  email: string;
  profileImage?: string;
  designation?: string;
  role?: string;
  weeklyOff?: string[];
}

interface DailyAttendance {
  date: string;
  employees: Array<{
    employee: Employee;
    attendance?: Attendance;
  }>;
}

interface AttendanceManagementProps {
  initialAttendance: Attendance[];
  isAdminOrHR?: boolean;
}

export default function AttendanceManagement({ initialAttendance, isAdminOrHR = false }: AttendanceManagementProps) {
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>(initialAttendance);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeesOnLeave, setEmployeesOnLeave] = useState<Set<string>>(new Set());
  
  // Month filter for personal attendance view (auto-detect current month)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  
  // Get initial filter from URL params
  const initialFilter = searchParams?.get('filter') || 'all';
  const [statusFilter, setStatusFilter] = useState<'all' | 'weekOff' | 'leave' | 'present'>(
    (initialFilter === 'leave' || initialFilter === 'weekOff' || initialFilter === 'present') 
      ? initialFilter 
      : 'all'
  );

  // Update filter when URL params change
  useEffect(() => {
    const filter = searchParams?.get('filter') || 'all';
    if (filter === 'leave' || filter === 'weekOff' || filter === 'present') {
      setStatusFilter(filter);
    } else {
      setStatusFilter('all');
    }
  }, [searchParams]);

  const fetchEmployeesOnLeave = useCallback(async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const res = await fetch(`/api/leave/on-leave-by-date?date=${dateStr}`);
      const data = await res.json();
      if (res.ok && data.userIdsOnLeave) {
        setEmployeesOnLeave(new Set(data.userIdsOnLeave));
      }
    } catch (err) {
      console.error('Error fetching employees on leave:', err);
    }
  }, [selectedDate]);

  const fetchAllEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok && data.users) {
        // Include both employees and HR users (exclude only admin)
        setEmployees(data.users.filter((u: Employee) => u.role !== 'admin'));
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const res = await fetch(`/api/attendance/by-date?date=${dateStr}`);
      const data = await res.json();
      if (res.ok && data.attendance) {
        setAttendance(data.attendance);
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
    }
  }, [selectedDate]);

  // Fetch all employees if admin/hr
  useEffect(() => {
    if (isAdminOrHR) {
      fetchAllEmployees();
    }
  }, [isAdminOrHR, fetchAllEmployees]);

  // Fetch attendance when date changes
  useEffect(() => {
    if (isAdminOrHR) {
      fetchAttendance();
      fetchEmployeesOnLeave();
    }
  }, [isAdminOrHR, selectedDate, fetchAttendance, fetchEmployeesOnLeave]);

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'hh:mm a');
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const formatDateDisplay = (date: Date) => {
    return format(date, 'EEEE, MMMM dd, yyyy');
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Month navigation functions
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedMonth(newMonth);
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Filter attendance by selected month for personal view
  const filteredAttendanceByMonth = useMemo(() => {
    if (isAdminOrHR) return initialAttendance;
    
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    return initialAttendance.filter((att) => {
      const attDate = parseISO(att.date);
      return attDate >= monthStart && attDate <= monthEnd;
    }).sort((a, b) => {
      // Sort by date descending (most recent first)
      return parseISO(b.date).getTime() - parseISO(a.date).getTime();
    });
  }, [initialAttendance, selectedMonth, isAdminOrHR]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return selectedMonth.getMonth() === now.getMonth() && 
           selectedMonth.getFullYear() === now.getFullYear();
  }, [selectedMonth]);

  // For employees: Calculate month display (used in return statement)
  const monthDisplay = format(selectedMonth, 'MMMM yyyy');
  const isCurrentMonthCheck = isCurrentMonth;

  // Prepare daily attendance data
  const dailyAttendance = useMemo(() => {
    if (!isAdminOrHR || employees.length === 0) {
      // For employees, use the old format
      return null;
    }

    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    const selectedDateObj = startOfDay(selectedDate);

    // Create a map of employee attendance for the selected date
    const attendanceMap = new Map<string, Attendance>();
    attendance.forEach((att) => {
      const attDate = startOfDay(new Date(att.date));
      if (isSameDay(attDate, selectedDateObj)) {
        const userId = att.userId?._id || '';
        // If multiple attendance records, keep the most recent one
        const existing = attendanceMap.get(userId);
        if (!existing || new Date(att.clockIn) > new Date(existing.clockIn)) {
          attendanceMap.set(userId, att);
        }
      }
    });

    // Get day name for weekly off check
    const selectedDayName = format(selectedDate, 'EEEE');

    // Combine employees with their attendance
    const dailyData: DailyAttendance = {
      date: selectedDateStr,
      employees: employees
        .filter((emp) => {
          // Filter by search term
          if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = (
              emp.name?.toLowerCase().includes(searchLower) ||
              emp.email?.toLowerCase().includes(searchLower) ||
              emp.designation?.toLowerCase().includes(searchLower)
            );
            if (!matchesSearch) return false;
          }

          // Filter by status
          if (statusFilter !== 'all') {
            const isOnLeave = employeesOnLeave.has(emp._id);
            const isWeeklyOff = emp.weeklyOff?.includes(selectedDayName) || false;
            const hasAttendance = !!attendanceMap.get(emp._id);
            const isPresent = hasAttendance && !isOnLeave && !isWeeklyOff;

            if (statusFilter === 'weekOff' && !isWeeklyOff) return false;
            if (statusFilter === 'leave' && !isOnLeave) return false;
            if (statusFilter === 'present' && !isPresent) return false;
          }

          return true;
        })
        .map((emp) => ({
          employee: emp,
          attendance: attendanceMap.get(emp._id),
        })),
    };

    return dailyData;
  }, [isAdminOrHR, employees, attendance, selectedDate, searchTerm, statusFilter, employeesOnLeave]);

  // For admin/hr: Show daily view with all employees
  // Show loading state if employees haven't loaded yet
  if (isAdminOrHR) {
    // If employees are still loading, show loading state instead of employee view
    if (loading && employees.length === 0) {
      return (
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-12 flex flex-col items-center justify-center">
          <LoadingDots size="lg" className="mb-3" />
          <p className="text-sm text-gray-500 font-secondary">Loading attendance data...</p>
        </div>
      );
    }

    // If dailyAttendance is null (employees not loaded yet), show loading
    if (!dailyAttendance) {
      return (
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-12 flex flex-col items-center justify-center">
          <LoadingDots size="lg" className="mb-3" />
          <p className="text-sm text-gray-500 font-secondary">Loading attendance data...</p>
        </div>
      );
    }

    const isToday = isSameDay(selectedDate, new Date());

    return (
      <div className="space-y-4">
        {/* Date Navigation */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <h2 className="text-lg font-primary font-bold text-gray-800">
                    {formatDateDisplay(selectedDate)}
                  </h2>
                  {isToday && (
                    <p className="text-xs text-blue-600 font-secondary">Today</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigateDate('next')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isToday}
              >
                <ChevronRight className={`w-5 h-5 ${isToday ? 'text-gray-300' : 'text-gray-600'}`} />
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Filters */}
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors font-secondary ${
                    statusFilter === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('present')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors font-secondary ${
                    statusFilter === 'present'
                      ? 'bg-green-100 text-green-800 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Present
                </button>
                <button
                  onClick={() => setStatusFilter('leave')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors font-secondary ${
                    statusFilter === 'leave'
                      ? 'bg-orange-100 text-orange-800 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Leave
                </button>
                <button
                  onClick={() => setStatusFilter('weekOff')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors font-secondary ${
                    statusFilter === 'weekOff'
                      ? 'bg-purple-100 text-purple-800 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  WeekOff
                </button>
              </div>
              
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-secondary text-sm"
              />
              {!isToday && (
                <button
                  onClick={goToToday}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-secondary text-sm font-semibold"
                >
                  Today
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by employee name, email, or designation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-secondary"
            />
          </div>
        </div>

        {/* Attendance List */}
        {loading ? (
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-12 flex flex-col items-center justify-center">
            <LoadingDots size="lg" className="mb-3" />
            <p className="text-sm text-gray-500 font-secondary">Loading attendance data...</p>
          </div>
        ) : dailyAttendance.employees.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-12 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-secondary">No employees found</p>
          </div>
        ) : (
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase font-primary">
                      Employee
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase font-primary">
                      Clock In
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase font-primary">
                      Clock Out
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase font-primary">
                      Hours Worked
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase font-primary">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {dailyAttendance.employees.map((item, index) => {
                    const att = item.attendance;
                    const hasClockedIn = !!att?.clockIn;
                    const hasClockedOut = !!att?.clockOut;
                    const isOnLeave = employeesOnLeave.has(item.employee._id);
                    
                    // Check if today is weekly off for this employee
                    const selectedDayName = format(selectedDate, 'EEEE'); // Gets day name like "Monday"
                    const isWeeklyOff = item.employee.weeklyOff?.includes(selectedDayName) || false;

                    return (
                      <motion.tr
                        key={item.employee._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={`transition-colors ${
                          isOnLeave 
                            ? 'bg-orange-50' 
                            : isWeeklyOff
                            ? 'bg-purple-200'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              name={item.employee.name}
                              image={item.employee.profileImage}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-semibold font-primary ${
                                  isOnLeave 
                                    ? 'text-orange-900' 
                                    : isWeeklyOff 
                                    ? 'text-purple-900' 
                                    : 'text-gray-900'
                                }`}>
                                  {item.employee.name}
                                </span>
                                {item.employee.role === 'hr' && (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full font-secondary bg-indigo-100 text-indigo-700 whitespace-nowrap">
                                    HR
                                  </span>
                                )}
                                {item.employee.designation && (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full font-secondary bg-blue-100 text-blue-700 whitespace-nowrap">
                                    {item.employee.designation}
                                  </span>
                                )}
                                {isOnLeave && (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full font-secondary bg-orange-200 text-orange-800 whitespace-nowrap flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    On Leave Today
                                  </span>
                                )}
                                {isWeeklyOff && !isOnLeave && (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full font-secondary bg-purple-100 text-purple-700 whitespace-nowrap flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Weekly Off
                                  </span>
                                )}
                              </div>
                              <div className={`mt-1 text-xs font-secondary truncate ${
                                isOnLeave 
                                  ? 'text-orange-700' 
                                  : isWeeklyOff 
                                  ? 'text-purple-700' 
                                  : 'text-gray-500'
                              }`}>
                                {item.employee.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {hasClockedIn ? (
                            <div className="flex items-center gap-1.5 text-sm text-gray-900 font-secondary">
                              <Clock className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                              <span className="font-medium">{formatTime(att!.clockIn)}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 font-secondary italic">Not clocked in</span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {hasClockedOut ? (
                            <div className="flex items-center gap-1.5 text-sm text-gray-900 font-secondary">
                              <Clock className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                              <span className="font-medium">{formatTime(att!.clockOut!)}</span>
                            </div>
                          ) : hasClockedIn ? (
                            <span className="text-xs text-orange-600 font-secondary font-medium">Still working</span>
                          ) : (
                            <span className="text-xs text-gray-400 font-secondary italic">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {att?.hoursWorked ? (
                            <span className="text-sm font-semibold text-gray-900 font-secondary">
                              {att.hoursWorked.toFixed(2)} hrs
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 font-secondary">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {hasClockedOut ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full font-secondary bg-green-100 text-green-800">
                              Completed
                            </span>
                          ) : hasClockedIn ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full font-secondary bg-blue-100 text-blue-800">
                              Working
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full font-secondary bg-red-100 text-red-800">
                              Absent
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  } else {
    // For employees: Show month filter and filtered attendance
    return (
      <div className="space-y-4">
        {/* Month Filter Navigation */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-gray-800 font-primary">
                  {monthDisplay}
                </h2>
              </div>
              
              <button
                onClick={() => navigateMonth('next')}
                disabled={isCurrentMonthCheck}
                className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${
                  isCurrentMonthCheck ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                aria-label="Next month"
              >
                <ChevronRight className={`w-5 h-5 ${isCurrentMonthCheck ? 'text-gray-300' : 'text-gray-600'}`} />
              </button>
            </div>

            {!isCurrentMonthCheck && (
              <button
                onClick={goToCurrentMonth}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-secondary text-sm font-semibold"
              >
                Current Month
              </button>
            )}
          </div>
        </div>

        {/* Attendance Table */}
        {!filteredAttendanceByMonth || filteredAttendanceByMonth.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-12 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-secondary">No attendance records found for {monthDisplay}</p>
          </div>
        ) : (
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 overflow-hidden">
            <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase font-primary">
                  Date
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase font-primary">
                  Clock In
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase font-primary">
                  Clock Out
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase font-primary">
                  Hours
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase font-primary">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredAttendanceByMonth.map((attendance) => (
                <tr key={attendance._id} className="hover:bg-gray-50 transition-colors">
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
                      {attendance.hoursWorked ? `${attendance.hoursWorked.toFixed(2)} hrs` : 'N/A'}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {attendance.clockOut ? (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full font-secondary bg-green-100 text-green-800">
                        Completed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full font-secondary bg-blue-100 text-blue-800">
                        Working
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    );
  }
}

