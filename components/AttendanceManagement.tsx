'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { format, startOfDay, isSameDay, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval } from 'date-fns';
import { Clock, Calendar, ChevronLeft, ChevronRight, Search, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';
import { formatTimeString12Hour, formatHoursToHHMMSS } from '@/lib/timeUtils';

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
  clockInTime?: string; // Individual clock-in time limit (HH:mm format or "N/R")
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
  const [penalties, setPenalties] = useState<Map<string, any>>(new Map());
  const [defaultTimeLimit, setDefaultTimeLimit] = useState<string>('');
  const [userClockInTime, setUserClockInTime] = useState<string | undefined>(undefined);
  const [selectedPenalty, setSelectedPenalty] = useState<any | null>(null);
  const [userWeeklyOff, setUserWeeklyOff] = useState<string[]>([]);
  const [leavesForMonth, setLeavesForMonth] = useState<Set<string>>(new Set());

  // Month filter for personal attendance view (auto-detect current month)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Get initial filter from URL params
  const initialFilter = searchParams?.get('filter') || 'all';
  const [statusFilter, setStatusFilter] = useState<'all' | 'weekOff' | 'leave' | 'present' | 'late'>(
    (initialFilter === 'leave' || initialFilter === 'weekOff' || initialFilter === 'present' || initialFilter === 'late')
      ? initialFilter
      : 'all'
  );

  // Update filter when URL params change
  useEffect(() => {
    const filter = searchParams?.get('filter') || 'all';
    if (filter === 'leave' || filter === 'weekOff' || filter === 'present' || filter === 'late') {
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

  const fetchPenalties = useCallback(async () => {
    if (!isAdminOrHR) {
      // For employees, fetch penalties for all dates in the current month
      try {
        const penaltyMap = new Map();

        // Get all unique dates from attendance records in the current month
        const monthStart = startOfMonth(selectedMonth);
        const monthEnd = endOfMonth(selectedMonth);
        const attendanceDates = new Set<string>();

        initialAttendance.forEach((att) => {
          const attDate = parseISO(att.date);
          if (attDate >= monthStart && attDate <= monthEnd) {
            attendanceDates.add(format(attDate, 'yyyy-MM-dd'));
          }
        });

        // Fetch penalties for each date
        const penaltyPromises = Array.from(attendanceDates).map(async (dateStr) => {
          try {
            const res = await fetch(`/api/attendance/penalty?date=${dateStr}`);
            const data = await res.json();
            if (res.ok && data.hasPenalty) {
              // Store penalty with date as key
              penaltyMap.set(dateStr, data.penaltyDetails);
            }
          } catch (err) {
            console.error(`Error fetching penalty for date ${dateStr}:`, err);
          }
        });

        await Promise.all(penaltyPromises);
        // For employees, also store with 'self' key for backward compatibility
        if (penaltyMap.size > 0) {
          // Get the most recent penalty (if multiple)
          const latestPenalty = Array.from(penaltyMap.values())[0];
          penaltyMap.set('self', latestPenalty);
        }
        setPenalties(penaltyMap);
      } catch (err) {
        console.error('Error fetching penalties:', err);
        setPenalties(new Map());
      }
    } else {
      // For admin/HR, fetch penalties for all employees on the selected date
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const penaltyMap = new Map();

        // Fetch penalties for each employee
        const employeeIds = employees.map(emp => emp._id);
        const penaltyPromises = employeeIds.map(async (userId) => {
          try {
            const res = await fetch(`/api/attendance/penalty?userId=${userId}&date=${dateStr}`);
            const data = await res.json();
            if (res.ok && data.hasPenalty) {
              penaltyMap.set(userId, data.penaltyDetails);
            }
          } catch (err) {
            console.error(`Error fetching penalty for user ${userId}:`, err);
          }
        });

        await Promise.all(penaltyPromises);
        setPenalties(penaltyMap);
      } catch (err) {
        console.error('Error fetching penalties:', err);
      }
    }
  }, [selectedDate, selectedMonth, employees, isAdminOrHR, initialAttendance]);

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

  const fetchDefaultTimeLimit = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/clock-in-time-limit');
      const data = await res.json();
      if (res.ok && data.defaultClockInTimeLimit) {
        setDefaultTimeLimit(data.defaultClockInTimeLimit);
      }
    } catch (err) {
      console.error('Error fetching default time limit:', err);
    }
  }, []);

  const fetchUserClockInTime = useCallback(async () => {
    if (!isAdminOrHR) {
      // For employees and HR viewing their own attendance, fetch their own clockInTime and weeklyOff
      try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        if (res.ok && data.user) {
          // Set clockInTime if available, or undefined if not set (will use default)
          setUserClockInTime(data.user.clockInTime || undefined);
          // Set weeklyOff if available
          setUserWeeklyOff(Array.isArray(data.user.weeklyOff) ? data.user.weeklyOff : []);
        }
      } catch (err) {
        console.error('Error fetching user clockInTime:', err);
      }
    }
  }, [isAdminOrHR]);

  // Fetch leaves for the selected month
  const fetchLeavesForMonth = useCallback(async () => {
    if (!isAdminOrHR) {
      try {
        const monthStart = startOfMonth(selectedMonth);
        const monthEnd = endOfMonth(selectedMonth);
        const today = startOfDay(new Date());
        const endDate = today <= monthEnd ? today : monthEnd;

        // Fetch all leaves for the user (API returns user's leaves)
        const res = await fetch('/api/leave');
        const data = await res.json();
        if (res.ok && data.leaves) {
          // Create a set of dates where user is on approved leave within the month
          const leaveDates = new Set<string>();
          data.leaves.forEach((leave: any) => {
            if (leave.status === 'approved' && !leave.allottedBy) {
              // Check if leave reason is not penalty-related
              const isPenaltyLeave = leave.reason && /penalty|clock.*in.*late|exceeded.*max.*late|auto.*deduct/i.test(leave.reason);
              if (!isPenaltyLeave) {
                const leaveStart = startOfDay(new Date(leave.startDate));
                const leaveEnd = startOfDay(new Date(leave.endDate));

                // Check if leave overlaps with the selected month
                if (leaveEnd >= monthStart && leaveStart <= endDate) {
                  // Calculate the actual range within the month
                  const rangeStart = leaveStart > monthStart ? leaveStart : monthStart;
                  const rangeEnd = leaveEnd < endDate ? leaveEnd : endDate;
                  const currentDate = new Date(rangeStart);

                  while (currentDate <= rangeEnd && currentDate <= today) {
                    leaveDates.add(format(currentDate, 'yyyy-MM-dd'));
                    currentDate.setDate(currentDate.getDate() + 1);
                  }
                }
              }
            }
          });
          setLeavesForMonth(leaveDates);
        }
      } catch (err) {
        console.error('Error fetching leaves for month:', err);
      }
    }
  }, [isAdminOrHR, selectedMonth]);

  // Helper function to check if clock-in is late
  const isLateClockIn = useCallback((clockInTime: string, userClockInTime?: string): boolean => {
    if (!clockInTime) return false;

    const clockIn = new Date(clockInTime);
    const clockInHours = clockIn.getHours();
    const clockInMinutes = clockIn.getMinutes();
    const clockInTotalMinutes = clockInHours * 60 + clockInMinutes;

    // Get time limit (user's custom or default)
    let timeLimit = '';
    if (userClockInTime && userClockInTime !== 'N/R') {
      timeLimit = userClockInTime;
    } else if (defaultTimeLimit) {
      timeLimit = defaultTimeLimit;
    }

    if (!timeLimit) return false;

    const [limitHours, limitMinutes] = timeLimit.split(':').map(Number);
    const limitTotalMinutes = limitHours * 60 + limitMinutes;

    return clockInTotalMinutes > limitTotalMinutes;
  }, [defaultTimeLimit]);

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

  // Fetch default time limit
  useEffect(() => {
    fetchDefaultTimeLimit();
  }, [fetchDefaultTimeLimit]);

  // Fetch user clockInTime and weeklyOff for employee view
  useEffect(() => {
    fetchUserClockInTime();
  }, [fetchUserClockInTime]);

  // Fetch leaves for the month
  useEffect(() => {
    fetchLeavesForMonth();
  }, [fetchLeavesForMonth]);

  // Fetch attendance when date changes
  useEffect(() => {
    if (isAdminOrHR) {
      fetchAttendance();
      fetchEmployeesOnLeave();
      fetchPenalties();
    } else {
      // For employees, fetch penalties for the month view
      fetchPenalties();
    }
  }, [isAdminOrHR, selectedDate, selectedMonth, fetchAttendance, fetchEmployeesOnLeave, fetchPenalties]);

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

  // Create a map of attendance records by date for quick lookup
  const attendanceByDateMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    initialAttendance.forEach((att) => {
      const dateStr = format(parseISO(att.date), 'yyyy-MM-dd');
      // If multiple records for same date, keep the most recent one
      const existing = map.get(dateStr);
      if (!existing || new Date(att.clockIn) > new Date(existing.clockIn)) {
        map.set(dateStr, att);
      }
    });
    return map;
  }, [initialAttendance]);

  // Generate all days in the selected month with their attendance records (up to today only)
  const allDaysWithAttendance = useMemo(() => {
    if (isAdminOrHR) return [];

    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const today = startOfDay(new Date());

    // Determine the end date: use today if it's in the selected month, otherwise use month end
    const endDate = today <= monthEnd ? today : monthEnd;

    // Generate all days in the month up to today
    const allDays = eachDayOfInterval({ start: monthStart, end: endDate });

    // Create array with each day and its attendance record (if any)
    return allDays.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const attendance = attendanceByDateMap.get(dateStr);
      const dayName = format(day, 'EEEE');
      const isWeeklyOff = userWeeklyOff.includes(dayName);
      const isOnLeave = leavesForMonth.has(dateStr);

      return {
        date: day,
        dateStr: dateStr,
        attendance: attendance || null,
        isWeeklyOff,
        isOnLeave,
      };
    }).sort((a, b) => {
      // Sort by date descending (most recent first)
      return b.date.getTime() - a.date.getTime();
    });
  }, [selectedMonth, attendanceByDateMap, isAdminOrHR, userWeeklyOff, leavesForMonth]);

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
            const isLate =
              hasAttendance &&
              !isOnLeave &&
              !isWeeklyOff &&
              (() => {
                const att = attendanceMap.get(emp._id);
                return att?.clockIn ? isLateClockIn(att.clockIn, emp.clockInTime) : false;
              })();

            if (statusFilter === 'weekOff' && !isWeeklyOff) return false;
            if (statusFilter === 'leave' && !isOnLeave) return false;
            if (statusFilter === 'present' && !isPresent) return false;
            if (statusFilter === 'late' && !isLate) return false;
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
        <div className="bg-white/95 backdrop-blur-xl rounded-md shadow-lg border border-white/50 p-12 flex flex-col items-center justify-center">
          <LoadingDots size="lg" className="mb-3" />
          <p className="text-sm text-gray-500 font-secondary">Loading attendance data...</p>
        </div>
      );
    }

    // If dailyAttendance is null (employees not loaded yet), show loading
    if (!dailyAttendance) {
      return (
        <div className="bg-white/95 backdrop-blur-xl rounded-md shadow-lg border border-white/50 p-12 flex flex-col items-center justify-center">
          <LoadingDots size="lg" className="mb-3" />
          <p className="text-sm text-gray-500 font-secondary">Loading attendance data...</p>
        </div>
      );
    }

    const isToday = isSameDay(selectedDate, new Date());

    return (
      <>
        <div className="space-y-4">
          {/* Date Navigation */}
          <div className="bg-white/95 backdrop-blur-xl rounded-md shadow-lg border border-white/50 p-4">
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
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors font-secondary ${statusFilter === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setStatusFilter('present')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors font-secondary ${statusFilter === 'present'
                      ? 'bg-green-100 text-green-800 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => setStatusFilter('late')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors font-secondary ${statusFilter === 'late'
                      ? 'bg-orange-100 text-orange-800 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    Late
                  </button>
                  <button
                    onClick={() => setStatusFilter('leave')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors font-secondary ${statusFilter === 'leave'
                      ? 'bg-orange-100 text-orange-800 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    Leave
                  </button>
                  <button
                    onClick={() => setStatusFilter('weekOff')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors font-secondary ${statusFilter === 'weekOff'
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
          <div className="bg-white/95 backdrop-blur-xl rounded-md shadow-lg border border-white/50 p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by employee name, email, or designation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-secondary"
                />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-sm font-semibold text-gray-700 font-secondary">Total:</span>
                <span className="text-lg font-bold text-blue-700 font-primary">
                  {dailyAttendance.employees.length}
                </span>
                <span className="text-xs text-gray-600 font-secondary">
                  {dailyAttendance.employees.length === 1 ? 'employee' : 'employees'}
                </span>
              </div>
            </div>
          </div>

          {/* Attendance List */}
          {loading ? (
            <div className="bg-white/95 backdrop-blur-xl rounded-md shadow-lg border border-white/50 p-12 flex flex-col items-center justify-center">
              <LoadingDots size="lg" className="mb-3" />
              <p className="text-sm text-gray-500 font-secondary">Loading attendance data...</p>
            </div>
          ) : dailyAttendance.employees.length === 0 ? (
            <div className="bg-white/95 backdrop-blur-xl rounded-md shadow-lg border border-white/50 p-12 text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-secondary">No employees found</p>
            </div>
          ) : (
            <div className="bg-white/95 backdrop-blur-xl rounded-md shadow-lg border border-white/50">
              <div className="overflow-x-auto" style={{ overflowY: 'visible' }}>
                <table className="w-full" style={{ overflow: 'visible' }}>
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
                        Total
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase font-primary">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100" style={{ overflow: 'visible' }}>
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
                        <td className="px-4 py-4 whitespace-nowrap overflow-visible">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              name={item.employee.name}
                              image={item.employee.profileImage}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1 overflow-visible">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2 flex-wrap overflow-visible">
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
                                  {(() => {
                                    const employeeId = item.employee._id;
                                    const penalty = penalties.get(employeeId);
                                    // Show penalty tag only on the date when penalty was actually created
                                    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
                                    const isPenaltyDate = penalty && (
                                      penalty.penaltyDate === selectedDateStr || 
                                      penalty.lateArrivalDate === selectedDateStr
                                    );
                                    const hasPenalty = isPenaltyDate && penalty && penalty.penaltyAmount > 0;
                                    
                                    if (hasPenalty) {
                                      return (
                                        <button
                                          onClick={() => setSelectedPenalty(penalty)}
                                          className="px-2 py-0.5 text-[10px] font-semibold rounded-full font-secondary bg-red-200 text-red-800 whitespace-nowrap flex items-center gap-1 cursor-pointer hover:bg-red-300 transition-colors"
                                        >
                                          <Clock className="w-3 h-3" />
                                          Penalty
                                        </button>
                                      );
                                    } else if (isOnLeave) {
                                      return (
                                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full font-secondary bg-orange-200 text-orange-800 whitespace-nowrap flex items-center gap-1">
                                          <Calendar className="w-3 h-3" />
                                          On Leave Today
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                  {isWeeklyOff && !isOnLeave && (
                                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full font-secondary bg-purple-100 text-purple-700 whitespace-nowrap flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      Weekly Off
                                    </span>
                                  )}
                                </div>
                                {item.employee.designation && (
                                  <span className="text-xs text-gray-600 font-secondary mt-0.5">
                                    {item.employee.designation}
                                  </span>
                                )}
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
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                    {hasClockedIn ? (
                      <div className="flex items-center gap-1.5 text-sm text-gray-900 font-secondary">
                        <Clock className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                        <span className="font-medium">{formatTime(att!.clockIn)}</span>
                        {isLateClockIn(att!.clockIn, item.employee.clockInTime) && (() => {
                          const timeLimit = item.employee.clockInTime && item.employee.clockInTime !== 'N/R' 
                            ? item.employee.clockInTime 
                            : defaultTimeLimit || '';
                          return (
                            <div className="relative group">
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full font-secondary bg-orange-100 text-orange-700 whitespace-nowrap flex items-center gap-1 cursor-help">
                                <AlertCircle className="w-3 h-3" />
                                Late
                              </span>
                              {timeLimit && (
                                <div className="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                  Time limit: {formatTimeString12Hour(timeLimit)}
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
                              {formatHoursToHHMMSS(att.hoursWorked)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 font-secondary">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {isOnLeave ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full font-secondary bg-orange-100 text-orange-800">
                              On Leave
                            </span>
                          ) : isWeeklyOff ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full font-secondary bg-purple-100 text-purple-800">
                              Weekly Off
                            </span>
                          ) : hasClockedOut ? (
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

        {/* Penalty Details Modal */}
        <AnimatePresence>
          {selectedPenalty && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPenalty(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal - Centered */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-red-100 rounded">
                  <Clock className="w-4 h-4 text-red-600" />
                </div>
                <h3 className="text-base font-primary font-bold text-gray-800">
                  Penalty Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedPenalty(null)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-red-50 rounded">
                  <span className="text-xs font-secondary text-gray-700">Penalty:</span>
                  <span className="text-xs font-semibold font-primary text-red-700">
                    {selectedPenalty.penaltyAmount} Casual Leave Deducted
                  </span>
                </div>

                <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 rounded">
                  <span className="text-xs font-secondary text-gray-700">Max Late Days:</span>
                  <span className="text-xs font-semibold font-primary text-gray-900">
                    {selectedPenalty.maxLateDays}
                  </span>
                </div>

                <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 rounded">
                  <span className="text-xs font-secondary text-gray-700">Late Arrivals:</span>
                  <span className="text-xs font-semibold font-primary text-gray-900">
                    {selectedPenalty.lateArrivalCount}
                  </span>
                </div>

                {/* Casual Leave Information */}
                {selectedPenalty.casualLeave && (
                  <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
                    <h4 className="text-xs font-semibold font-primary text-gray-800 mb-1.5">
                      Casual Leave Impact
                    </h4>
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-blue-50 rounded">
                      <span className="text-xs font-secondary text-gray-700">Total Casual Leave:</span>
                      <span className="text-xs font-semibold font-primary text-blue-700">
                        {selectedPenalty.casualLeave.total} days
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-orange-50 rounded">
                      <span className="text-xs font-secondary text-gray-700">Deducted (Penalty):</span>
                      <span className="text-xs font-semibold font-primary text-orange-700">
                        -{selectedPenalty.casualLeave.deducted} days
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-green-50 rounded">
                      <span className="text-xs font-secondary text-gray-700">Updated Leave:</span>
                      <span className="text-xs font-semibold font-primary text-green-700">
                        {selectedPenalty.casualLeave.remaining} days
                      </span>
                    </div>
                  </div>
                )}

                {selectedPenalty.lateArrivals && selectedPenalty.lateArrivals.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <h4 className="text-xs font-semibold font-primary text-gray-800 mb-2">
                      Late Days History
                    </h4>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {selectedPenalty.lateArrivals.map((arrival: any, idx: number) => (
                        <div key={idx} className="px-2 py-1.5 bg-gray-50 rounded border border-gray-200">
                          <div className="text-[10px] font-secondary text-gray-600 mb-0.5">
                            {arrival.date}
                          </div>
                          <div className="text-xs font-primary text-gray-900">
                            Clock In: <span className="font-semibold">{formatTimeString12Hour(arrival.clockInTime)}</span>
                          </div>
                          <div className="text-[10px] font-secondary text-gray-500">
                            Limit: {formatTimeString12Hour(selectedPenalty.timeLimit)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
          )}
        </AnimatePresence>
      </>
    );
  } else {
    // For employees: Show month filter and filtered attendance
    return (
      <>
        <div className="space-y-4">
          {/* Month Filter Navigation */}
          <div className="bg-white/95 backdrop-blur-xl rounded-md shadow-lg border border-white/50 p-4">
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
                  className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${isCurrentMonthCheck ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          {!allDaysWithAttendance || allDaysWithAttendance.length === 0 ? (
            <div className="bg-white/95 backdrop-blur-xl rounded-md shadow-lg border border-white/50 p-12 text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-secondary">No days found for {monthDisplay}</p>
            </div>
          ) : (
            <div className="bg-white/95 backdrop-blur-xl rounded-md shadow-lg border border-white/50">
              <div className="overflow-x-auto" style={{ overflowY: 'visible' }}>
                <table className="w-full" style={{ overflow: 'visible' }}>
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
                        Total
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase font-primary">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100" style={{ overflow: 'visible' }}>
                    {allDaysWithAttendance.map((dayData) => {
                      const attendance = dayData.attendance;
                      const hasClockedIn = !!attendance?.clockIn;
                      const hasClockedOut = !!attendance?.clockOut;
                      const isWeeklyOff = dayData.isWeeklyOff;
                      const isOnLeave = dayData.isOnLeave;

                      return (
                        <tr key={dayData.dateStr} className={`hover:bg-gray-50 transition-colors ${isOnLeave
                          ? 'bg-orange-50'
                          : isWeeklyOff
                            ? 'bg-purple-100'
                            : !hasClockedIn
                              ? 'bg-gray-50/50'
                              : ''
                          }`}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className={`text-sm font-secondary ${isWeeklyOff ? 'text-purple-900' : isOnLeave ? 'text-orange-900' : 'text-gray-900'
                              }`}>
                              <div className="font-semibold">{format(dayData.date, 'EEEE')}</div>
                              <div className={`text-xs mt-0.5 ${isWeeklyOff ? 'text-purple-600' : isOnLeave ? 'text-orange-600' : 'text-gray-500'
                                }`}>{format(dayData.date, 'MMM dd, yyyy')}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {hasClockedIn ? (
                              <div className="flex items-center gap-1.5 text-sm text-gray-900 font-secondary">
                                <Clock className="w-3.5 h-3.5 text-green-600" />
                                {formatTime(attendance.clockIn)}
                                {isLateClockIn(attendance.clockIn, userClockInTime) && (() => {
                                  const timeLimit = userClockInTime && userClockInTime !== 'N/R'
                                    ? userClockInTime
                                    : defaultTimeLimit || '';
                                  return (
                                    <div className="relative group">
                                      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full font-secondary bg-orange-100 text-orange-700 whitespace-nowrap flex items-center gap-1 cursor-help">
                                        <AlertCircle className="w-3 h-3" />
                                        Late
                                      </span>
                                      {timeLimit && (
                                        <div className="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                          Time limit: {formatTimeString12Hour(timeLimit)}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <span className={`text-xs font-secondary italic ${isWeeklyOff ? 'text-purple-500' : isOnLeave ? 'text-orange-500' : 'text-gray-400'
                                }`}>Not clocked in</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {hasClockedOut && attendance?.clockOut ? (
                              <div className="flex items-center gap-1.5 text-sm text-gray-900 font-secondary">
                                <Clock className="w-3.5 h-3.5 text-red-600" />
                                {formatTime(attendance.clockOut)}
                              </div>
                            ) : hasClockedIn ? (
                              <span className="text-xs text-orange-600 font-secondary font-medium">Still working</span>
                            ) : (
                              <span className={`text-xs font-secondary ${isWeeklyOff ? 'text-purple-400' : isOnLeave ? 'text-orange-400' : 'text-gray-400'
                                }`}>-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {attendance?.hoursWorked ? (
                              <div className="text-sm text-gray-900 font-secondary">
                                {formatHoursToHHMMSS(attendance.hoursWorked)}
                              </div>
                            ) : (
                              <span className={`text-xs font-secondary ${isWeeklyOff ? 'text-purple-400' : isOnLeave ? 'text-orange-400' : 'text-gray-400'
                                }`}>-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap overflow-visible">
                            <div className="flex items-center gap-2 overflow-visible flex-wrap">
                              {isOnLeave ? (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full font-secondary bg-orange-100 text-orange-800 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  On Leave
                                </span>
                              ) : isWeeklyOff ? (
                                <>
                                  <span className="px-2 py-0.5 text-xs font-medium rounded-full font-secondary bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Weekly Off
                                  </span>
                                </>
                              ) : hasClockedOut ? (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full font-secondary bg-green-100 text-green-800">
                                  Completed
                                </span>
                              ) : hasClockedIn ? (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full font-secondary bg-blue-100 text-blue-800">
                                  Working
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full font-secondary bg-red-100 text-red-800">
                                  Absent
                                </span>
                              )}
                              {(() => {
                                const attendanceDate = dayData.dateStr;
                                // For employees, check penalty for this specific date
                                const penalty = penalties.get(attendanceDate) || penalties.get('self');
                                // Show penalty tag only on the date when penalty was actually created
                                // Check if this date matches the penalty date (when penalty was created)
                                const isPenaltyDate = penalty && (
                                  penalty.penaltyDate === attendanceDate ||
                                  penalty.lateArrivalDate === attendanceDate
                                );

                                if (isPenaltyDate) {
                                  return (
                                    <button
                                      onClick={() => setSelectedPenalty(penalty)}
                                      className="px-2 py-0.5 text-xs font-semibold rounded-full font-secondary bg-red-200 text-red-800 cursor-pointer hover:bg-red-300 transition-colors"
                                    >
                                      Penalty
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Penalty Details Modal */}
        <AnimatePresence>
          {selectedPenalty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPenalty(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* Modal - Centered */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="relative bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-red-100 rounded">
                    <Clock className="w-4 h-4 text-red-600" />
                  </div>
                  <h3 className="text-base font-primary font-bold text-gray-800">
                    Penalty Details
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedPenalty(null)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Content */}
              <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-red-50 rounded">
                    <span className="text-xs font-secondary text-gray-700">Penalty:</span>
                    <span className="text-xs font-semibold font-primary text-red-700">
                      {selectedPenalty.penaltyAmount} Casual Leave Deducted
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 rounded">
                    <span className="text-xs font-secondary text-gray-700">Max Late Days:</span>
                    <span className="text-xs font-semibold font-primary text-gray-900">
                      {selectedPenalty.maxLateDays}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 rounded">
                    <span className="text-xs font-secondary text-gray-700">Late Arrivals:</span>
                    <span className="text-xs font-semibold font-primary text-gray-900">
                      {selectedPenalty.lateArrivalCount}
                    </span>
                  </div>

                  {/* Casual Leave Information */}
                  {selectedPenalty.casualLeave && (
                    <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
                      <h4 className="text-xs font-semibold font-primary text-gray-800 mb-1.5">
                        Casual Leave Impact
                      </h4>
                      <div className="flex items-center justify-between px-2.5 py-1.5 bg-blue-50 rounded">
                        <span className="text-xs font-secondary text-gray-700">Total Casual Leave:</span>
                        <span className="text-xs font-semibold font-primary text-blue-700">
                          {selectedPenalty.casualLeave.total} days
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-2.5 py-1.5 bg-orange-50 rounded">
                        <span className="text-xs font-secondary text-gray-700">Deducted (Penalty):</span>
                        <span className="text-xs font-semibold font-primary text-orange-700">
                          -{selectedPenalty.casualLeave.deducted} days
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-2.5 py-1.5 bg-green-50 rounded">
                        <span className="text-xs font-secondary text-gray-700">Updated Leave:</span>
                        <span className="text-xs font-semibold font-primary text-green-700">
                          {selectedPenalty.casualLeave.remaining} days
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedPenalty.lateArrivals && selectedPenalty.lateArrivals.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <h4 className="text-xs font-semibold font-primary text-gray-800 mb-2">
                        Late Days History
                      </h4>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {selectedPenalty.lateArrivals.map((arrival: any, idx: number) => (
                          <div key={idx} className="px-2 py-1.5 bg-gray-50 rounded border border-gray-200">
                            <div className="text-[10px] font-secondary text-gray-600 mb-0.5">
                              {arrival.date}
                            </div>
                            <div className="text-xs font-primary text-gray-900">
                              Clock In: <span className="font-semibold">{formatTimeString12Hour(arrival.clockInTime)}</span>
                            </div>
                            <div className="text-[10px] font-secondary text-gray-500">
                              Limit: {formatTimeString12Hour(selectedPenalty.timeLimit)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
  }
}

