'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, LogIn, LogOut, CheckCircle, RotateCcw, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import LoadingDots from './LoadingDots';

interface AttendanceRecord {
  _id: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  hoursWorked?: number;
}

export default function TimeTrackingWidget() {
  const toast = useToast();
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [autoClockOutScheduled, setAutoClockOutScheduled] = useState(false);
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<{ [key: string]: Array<{ summary: string; description: string }> }>({});
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showEventPopup, setShowEventPopup] = useState(false);
  const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(null);
  const [selectedEventDetails, setSelectedEventDetails] = useState<Array<{ summary: string; description: string }>>([]);
  
  // Carousel state for mobile
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Handle touch events for carousel
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentSlide < 1) {
      setCurrentSlide(currentSlide + 1);
    }
    if (isRightSwipe && currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const checkClockStatus = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/attendance?date=${today}`);
      const data = await res.json();

      // Check if there's an active session (clocked in but not clocked out)
      if (data.attendance && data.attendance.clockIn && !data.attendance.clockOut) {
        setClockedIn(true);
        setClockInTime(new Date(data.attendance.clockIn));
      } else {
        setClockedIn(false);
        setClockInTime(null);
        setAutoClockOutScheduled(false);
      }
    } catch (err) {
      console.error('Error checking clock status:', err);
    }
  };

  const fetchRecentAttendance = async () => {
    try {
      setAttendanceLoading(true);
      const res = await fetch('/api/attendance');
      const data = await res.json();

      if (res.ok && data.attendance) {
        // Handle both array and single object responses
        let attendanceArray: AttendanceRecord[] = [];

        if (Array.isArray(data.attendance)) {
          attendanceArray = data.attendance;
        } else if (data.attendance && typeof data.attendance === 'object') {
          // Single attendance object - convert to array
          attendanceArray = [data.attendance];
        }

        // Sort by clockIn time (most recent first) and take top 3
        const sorted = attendanceArray
          .sort((a: AttendanceRecord, b: AttendanceRecord) => {
            const timeA = new Date(a.clockIn).getTime();
            const timeB = new Date(b.clockIn).getTime();
            return timeB - timeA;
          })
          .slice(0, 3);

        setRecentAttendance(sorted);
      }
    } catch (err) {
      console.error('Error fetching recent attendance:', err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const checkAutoClockOut = useCallback(async () => {
    if (!clockedIn) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // If it's 11:00 PM (23:00) or later
    if (currentHour === 23) {
      // If it's after 11:11 PM, immediately clock out
      if (currentMinute >= 11) {
        try {
          // Double-check that employee is still clocked in
          const today = new Date().toISOString().split('T')[0];
          const res = await fetch(`/api/attendance?date=${today}`);
          const data = await res.json();

          if (data.attendance && data.attendance.clockIn && !data.attendance.clockOut) {
            // Perform automatic clock-out immediately
            const clockOutRes = await fetch('/api/attendance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'clockOut', autoClockOut: true }),
            });

            if (clockOutRes.ok) {
              setClockedIn(false);
              setClockInTime(null);
              setAutoClockOutScheduled(false);
              toast.success('Automatically clocked out at 11:11 PM');
              fetchRecentAttendance();
              checkClockStatus();
            }
          }
        } catch (err) {
          console.error('Error during automatic clock-out:', err);
        }
      } 
      // If it's between 11:00 PM and 11:11 PM, schedule clock-out for 11:11 PM
      else if (currentMinute >= 0 && currentMinute < 11 && !autoClockOutScheduled) {
        setAutoClockOutScheduled(true);
        
        // Calculate milliseconds until 11:11 PM
        const targetTime = new Date(now);
        targetTime.setHours(23, 11, 0, 0);
        const delayMs = targetTime.getTime() - now.getTime();

        if (delayMs > 0) {
          setTimeout(async () => {
            try {
              // Double-check that employee is still clocked in
              const today = new Date().toISOString().split('T')[0];
              const res = await fetch(`/api/attendance?date=${today}`);
              const data = await res.json();

              if (data.attendance && data.attendance.clockIn && !data.attendance.clockOut) {
                // Perform automatic clock-out
                const clockOutRes = await fetch('/api/attendance', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'clockOut', autoClockOut: true }),
                });

                if (clockOutRes.ok) {
                  setClockedIn(false);
                  setClockInTime(null);
                  setAutoClockOutScheduled(false);
                  toast.success('Automatically clocked out at 11:11 PM');
                  fetchRecentAttendance();
                  checkClockStatus();
                }
              } else {
                setAutoClockOutScheduled(false);
              }
            } catch (err) {
              console.error('Error during automatic clock-out:', err);
              setAutoClockOutScheduled(false);
            }
          }, delayMs);
        }
      }
    }
  }, [clockedIn, autoClockOutScheduled, toast]);

  useEffect(() => {
    // Set mounted flag and initial time on client side only
    setMounted(true);
    setCurrentTime(new Date());

    checkClockStatus();
    fetchRecentAttendance();

    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Check clock status every 30 seconds
    const statusInterval = setInterval(() => {
      checkClockStatus();
    }, 30000);

    // Check for automatic clock-out every minute
    const autoClockOutInterval = setInterval(() => {
      checkAutoClockOut();
    }, 60000); // Check every minute

    // Initial check for auto clock-out
    checkAutoClockOut();

    return () => {
      clearInterval(timeInterval);
      clearInterval(statusInterval);
      clearInterval(autoClockOutInterval);
    };
  }, [checkAutoClockOut]);

  // Also check when clockedIn status changes
  useEffect(() => {
    if (clockedIn) {
      checkAutoClockOut();
    } else {
      setAutoClockOutScheduled(false);
    }
  }, [clockedIn, checkAutoClockOut]);

  const handleClockInOut = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: clockedIn ? 'clockOut' : 'clockIn' }),
      });

      const data = await res.json();

      if (res.ok) {
        if (clockedIn) {
          setClockedIn(false);
          setClockInTime(null);
          toast.success('Clocked out successfully');
        } else {
          setClockedIn(true);
          setClockInTime(new Date());
          toast.success('Clocked in successfully');
        }
        fetchRecentAttendance();
        checkClockStatus();
      } else {
        toast.error(data.error || 'An error occurred');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'hh:mm:ss a');
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'MMM dd, yyyy');
  };

  const formatClockInDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'EEE, MMM dd');
  };

  const formatTimeOnly = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'hh:mm a');
  };

  const formatTimeDisplay = (date: Date) => {
    const hours12 = format(date, 'hh');
    const minutes = format(date, 'mm');
    const seconds = format(date, 'ss');
    const period = format(date, 'a');
    return { hours: hours12, minutes, seconds, period };
  };

  const formatDuration = (hours?: number) => {
    if (!hours) return '00:00:00';
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const s = Math.floor(((hours - h) * 60 - m) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const calculateDuration = (clockIn: string, clockOut: string) => {
    const inTime = new Date(clockIn).getTime();
    const outTime = new Date(clockOut).getTime();
    const diffMs = outTime - inTime;
    const hours = diffMs / (1000 * 60 * 60);
    return formatDuration(hours);
  };

  // Calculate elapsed time if clocked in
  const calculateElapsedTime = () => {
    if (!clockedIn || !clockInTime || !currentTime) return '00:00:00';
    const diffMs = currentTime.getTime() - clockInTime.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    return formatDuration(hours);
  };

  // Get calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Get attendance dates for calendar highlighting
  const attendanceDates = recentAttendance.map(record => {
    const date = new Date(record.date);
    return format(date, 'yyyy-MM-dd');
  });

  // Helper function to clean description text
  const cleanDescription = (description: string): string => {
    if (!description) return '';
    // Remove the observance text
    const observancePattern = /Observance\s+To\s+hide\s+observances,?\s+go\s+to\s+Google\s+Calendar\s+Settings\s+>\s+Holidays\s+in\s+India/gi;
    return description.replace(observancePattern, '').trim();
  };

  // Fetch calendar events for the current month
  const fetchCalendarEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const timeMin = monthStart.toISOString();
      const timeMax = new Date(monthEnd.getTime() + 24 * 60 * 60 * 1000).toISOString();
      
      const res = await fetch(`/api/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`);
      const data = await res.json();
      
      if (res.ok && data.events) {
        // Group events by date with full details
        const eventsByDate: { [key: string]: Array<{ summary: string; description: string }> } = {};
        data.events.forEach((event: any) => {
          if (event.date) {
            if (!eventsByDate[event.date]) {
              eventsByDate[event.date] = [];
            }
            eventsByDate[event.date].push({
              summary: event.summary || 'Event',
              description: cleanDescription(event.description || ''),
            });
          }
        });
        setCalendarEvents(eventsByDate);
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err);
    } finally {
      setEventsLoading(false);
    }
  }, [currentMonth]);

  // Fetch events when month changes
  useEffect(() => {
    fetchCalendarEvents();
  }, [fetchCalendarEvents]);

  return (
    <>
      {/* Mobile Carousel Container */}
      <div className="lg:hidden relative overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Slide 1: Time Tracking Widget */}
          <div className="min-w-full flex-shrink-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative bg-white rounded-md shadow-lg overflow-hidden border border-gray-200 h-full flex flex-col"
            >
        <div className="p-6 flex-1 flex flex-col">
          {/* Status Badge - Clocked In */}
        {clockedIn && (
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 text-green-500 px-2 py-0.5 rounded-lg text-[10px] font-semibold">
              Clocked In
            </div>
          </div>
        )}

        {/* Current Time / Elapsed Time Display - Top Section */}
        <div className="text-center mb-6">
          <div className="mb-2">
            {clockedIn && clockInTime ? (
              // Elapsed Time with different background colors
              <div className="flex items-center justify-center gap-2">
                {(() => {
                  const elapsed = calculateElapsedTime();
                  const [hours, minutes, seconds] = elapsed.split(':');
                  return (
                    <>
                      <span className="text-4xl md:text-5xl font-primary font-bold text-primary bg-primary-100 px-3 py-2 rounded-md shadow-sm">
                        {hours}
                      </span>
                      <span className="text-4xl md:text-5xl font-primary font-bold text-gray-900">:</span>
                      <span className="text-4xl md:text-5xl font-primary font-bold text-primary bg-primary-100 px-3 py-2 rounded-md shadow-sm">
                        {minutes}
                      </span>
                      <span className="text-4xl md:text-5xl font-primary font-bold text-gray-900">:</span>
                      <span className="text-4xl md:text-5xl font-primary font-bold text-primary bg-primary-100 px-3 py-2 rounded-md shadow-sm">
                        {seconds}
                      </span>
                    </>
                  );
                })()}
              </div>
            ) : (
              // Current Time with different background colors
              <div className="flex items-center justify-center gap-2">
                {mounted && currentTime ? (
                  (() => {
                    const { hours, minutes, seconds, period } = formatTimeDisplay(currentTime);
                    return (
                      <>
                        <span className="text-4xl md:text-5xl font-primary font-bold text-primary bg-primary-100 px-3 py-2 rounded-md shadow-sm">
                          {hours}
                        </span>
                        <span className="text-4xl md:text-5xl font-primary font-bold text-gray-900">:</span>
                        <span className="text-4xl md:text-5xl font-primary font-bold text-primary bg-primary-100 px-3 py-2 rounded-md shadow-sm">
                          {minutes}
                        </span>
                        <span className="text-4xl md:text-5xl font-primary font-bold text-gray-900">:</span>
                        <span className="text-4xl md:text-5xl font-primary font-bold text-primary bg-primary-100 px-3 py-2 rounded-md shadow-sm">
                          {seconds}
                        </span>
                        <span className="text-2xl md:text-3xl font-primary font-bold text-primary ml-2">
                          {period}
                        </span>
                      </>
                    );
                  })()
                ) : (
                  <span className="text-4xl md:text-5xl font-primary font-bold text-gray-900">--:--:--</span>
                )}
              </div>
            )}
          </div>
          <div>
            <span className="text-sm font-secondary text-gray-500">
              {mounted && currentTime ? formatDate(currentTime) : '--- --, ----'}
            </span>
          </div>
        </div>

        {/* Clocked In Details */}
        {clockedIn && clockInTime && (
          <div className="text-center mb-6">
            <p className="text-sm font-semibold text-gray-500">
              Clocked in: <span className="font-bold text-gray-900">{formatClockInDate(clockInTime)} at {formatTimeOnly(clockInTime)}</span>
            </p>
          </div>
        )}

        {/* Clock In/Out Button */}
        <motion.button
          onClick={handleClockInOut}
          disabled={loading}
          whileHover={{ scale: loading ? 1 : 1.02 }}
          whileTap={{ scale: loading ? 1 : 0.98 }}
          className={`w-full py-4 rounded-xl font-semibold text-base transition-all shadow-lg flex items-center justify-center gap-2 mb-6 ${
            clockedIn
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <>
              <LoadingDots size="sm" color="white" />
              <span>Processing...</span>
            </>
          ) : clockedIn ? (
            <>
              <div className="w-5 h-5 bg-white/20 rounded flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </div>
              <span>Clock Out</span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 bg-white/20 rounded flex items-center justify-center">
                <LogIn className="w-4 h-4" />
              </div>
              <span>Clock In</span>
            </>
          )}
        </motion.button>

        {/* Recent 3 Attendance History - Compact Single Line */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <RotateCcw className="w-4 h-4 text-gray-600" />
            <h3 className="text-sm font-primary font-semibold text-gray-900">Recent Attendance</h3>
          </div>

          <div className="space-y-2">
            {attendanceLoading ? (
              <div className="text-center py-4">
                <LoadingDots size="sm" className="mb-2" />
                <p className="text-xs text-gray-500 font-secondary">Loading...</p>
              </div>
            ) : recentAttendance.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-gray-500 font-secondary">No attendance records yet</p>
              </div>
            ) : (
              recentAttendance.slice(0, 3).map((record, index) => (
                <motion.div
                  key={record._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-1 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-1.5 rounded ${record.clockOut ? 'bg-green-100' : 'bg-yellow-100'}`}>
                      <CheckCircle className={`w-3.5 h-3.5 ${record.clockOut ? 'text-green-600' : 'text-yellow-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-gray-900 font-semibold">{formatDate(record.date)}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600 font-bold">{formatTimeOnly(record.clockIn)}</span>
                        {record.clockOut && (
                          <>
                            <span className="text-gray-400">-</span>
                            <span className="text-gray-600 font-bold">{formatTimeOnly(record.clockOut)}</span>
                          </>
                        )}
                        {record.clockOut && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600 font-bold">
                              {calculateDuration(record.clockIn, record.clockOut)}
                            </span>
                          </>
                        )}
                        {!record.clockOut && (
                          <span className="text-yellow-600 font-bold ml-1">(Active)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
        </div>
            </motion.div>
          </div>

          {/* Slide 2: Calendar Widget */}
          <div className="min-w-full flex-shrink-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative bg-white rounded-md shadow-lg overflow-hidden border border-gray-200 h-full"
            >
        <div className="p-2.5 h-full flex flex-col">
          {/* Calendar Header with Navigation - Ultra Compact */}
          <div className="flex items-center justify-between mb-2 p-2 bg-gray-100 rounded-lg">
            <button
              onClick={prevMonth}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronLeft className="w-3 h-3 text-gray-600" />
            </button>
            <div className="text-center flex-1">
              <h4 className="text-[18px] font-primary font-bold text-gray-900">
                {format(currentMonth, 'MMM yyyy')}
              </h4>
            </div>
            <button
              onClick={nextMonth}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronRight className="w-3 h-3 text-gray-600" />
            </button>
          </div>

          {/* Calendar Grid - Ultra Compact */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Day Headers - Ultra Compact */}
            <div className="grid grid-cols-7 gap-0 mb-2">
              {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((day) => (
                <div
                  key={day}
                  className="text-center text-[12px] text-gray-400 font-bold"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days - Ultra Compact */}
            <div className="grid grid-cols-7 gap-0.5 flex-1">
              {calendarDays.map((day, idx) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());
                const isSelected = isSameDay(day, selectedDate);
                const hasEvent = calendarEvents[dayKey] && calendarEvents[dayKey].length > 0;
                
                // Selected date or today gets green circle
                const isHighlighted = isSelected || isToday;

                const handleDateClick = () => {
                  setSelectedDate(day);
                  if (hasEvent) {
                    setSelectedEventDate(day);
                    setSelectedEventDetails(calendarEvents[dayKey]);
                    setShowEventPopup(true);
                  }
                };

                return (
                  <motion.button
                    key={idx}
                    onClick={handleDateClick}
                    whileTap={{ scale: 0.9 }}
                    className={`
                      relative rounded-full text-[12px] font-semibold p-0
                      aspect-square w-full flex items-center justify-center
                      ${!isCurrentMonth ? 'text-gray-200' : isHighlighted ? 'text-white' : 'text-gray-700 bg-gray-100'}
                      ${isHighlighted ? 'bg-green-500 font-semibold' : ''}
                      ${!isHighlighted && isCurrentMonth ? 'hover:bg-gray-50 active:bg-gray-100' : ''}
                    `}
                  >
                    <span className="relative z-10 leading-none">{format(day, 'd')}</span>
                    {/* Event/Festival Dot - Upper Right Corner */}
                    {hasEvent && !isHighlighted && (
                      <div className="absolute top-2 right-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      </div>
                    )}
                    {/* Event dot for highlighted dates */}
                    {hasEvent && isHighlighted && (
                      <div className="absolute top-2 right-2">
                        <div className="w-1.5 h-1.5 bg-white rounded-full border border-green-600"></div>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Carousel Navigation Dots - Mobile Only */}
      <div className="lg:hidden flex justify-center gap-2 mt-4">
        <button
          onClick={() => setCurrentSlide(0)}
          className={`w-2 h-2 rounded-full transition-all ${
            currentSlide === 0 ? 'bg-blue-600 w-6' : 'bg-gray-300'
          }`}
        />
        <button
          onClick={() => setCurrentSlide(1)}
          className={`w-2 h-2 rounded-full transition-all ${
            currentSlide === 1 ? 'bg-blue-600 w-6' : 'bg-gray-300'
          }`}
        />
      </div>

      {/* Desktop Layout - Side by Side */}
      <div className="hidden lg:contents">
        {/* Time Tracking Widget - Desktop */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-white rounded-md shadow-lg overflow-hidden border border-gray-200 h-full flex flex-col"
        >
          <div className="p-6 flex-1 flex flex-col">
            {/* Status Badge - Clocked In */}
            {clockedIn && (
              <div className="flex justify-center mb-4">
                <div className="bg-green-100 text-green-500 px-2 py-0.5 rounded-lg text-[10px] font-semibold">
                  Clocked In
                </div>
              </div>
            )}

            {/* Current Time / Elapsed Time Display - Top Section */}
            <div className="text-center mb-6">
              <div className="mb-2">
                {clockedIn && clockInTime ? (
                  // Elapsed Time with different background colors
                  <div className="flex items-center justify-center gap-2">
                    {(() => {
                      const elapsed = calculateElapsedTime();
                      const [hours, minutes, seconds] = elapsed.split(':');
                      return (
                        <>
                          <span className="text-4xl md:text-5xl font-primary font-bold text-primary bg-primary-100 px-3 py-2 rounded-md shadow-sm">
                            {hours}
                          </span>
                          <span className="text-4xl md:text-5xl font-primary font-bold text-gray-900">:</span>
                          <span className="text-4xl md:text-5xl font-primary font-bold text-primary bg-primary-100 px-3 py-2 rounded-md shadow-sm">
                            {minutes}
                          </span>
                          <span className="text-4xl md:text-5xl font-primary font-bold text-gray-900">:</span>
                          <span className="text-4xl md:text-5xl font-primary font-bold text-primary bg-primary-100 px-3 py-2 rounded-md shadow-sm">
                            {seconds}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  // Current Time with different background colors
                  <div className="flex items-center justify-center gap-2">
                    {mounted && currentTime ? (
                      (() => {
                        const { hours, minutes, seconds, period } = formatTimeDisplay(currentTime);
                        return (
                          <>
                            <span className="text-4xl md:text-5xl font-primary font-bold text-primary bg-primary-100 px-3 py-2 rounded-md shadow-sm">
                              {hours}
                            </span>
                            <span className="text-4xl md:text-5xl font-primary font-bold text-gray-900">:</span>
                            <span className="text-4xl md:text-5xl font-primary font-bold text-primary bg-primary-100 px-3 py-2 rounded-md shadow-sm">
                              {minutes}
                            </span>
                            <span className="text-4xl md:text-5xl font-primary font-bold text-gray-900">:</span>
                            <span className="text-4xl md:text-5xl font-primary font-bold text-primary bg-primary-100 px-3 py-2 rounded-md shadow-sm">
                              {seconds}
                            </span>
                            <span className="text-2xl md:text-3xl font-primary font-bold text-primary ml-2">
                              {period}
                            </span>
                          </>
                        );
                      })()
                    ) : (
                      <span className="text-4xl md:text-5xl font-primary font-bold text-gray-900">--:--:--</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <span className="text-sm font-secondary text-gray-500">
                  {mounted && currentTime ? formatDate(currentTime) : '--- --, ----'}
                </span>
              </div>
            </div>

            {/* Clocked In Details */}
            {clockedIn && clockInTime && (
              <div className="text-center mb-6">
                <p className="text-sm font-semibold text-gray-500">
                  Clocked in: <span className="font-bold text-gray-900">{formatClockInDate(clockInTime)} at {formatTimeOnly(clockInTime)}</span>
                </p>
              </div>
            )}

            {/* Clock In/Out Button */}
            <motion.button
              onClick={handleClockInOut}
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className={`w-full py-4 rounded-xl font-semibold text-base transition-all shadow-lg flex items-center justify-center gap-2 mb-6 ${
                clockedIn
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <>
                  <LoadingDots size="sm" color="white" />
                  <span>Processing...</span>
                </>
              ) : clockedIn ? (
                <>
                  <div className="w-5 h-5 bg-white/20 rounded flex items-center justify-center">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <span>Clock Out</span>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 bg-white/20 rounded flex items-center justify-center">
                    <LogIn className="w-4 h-4" />
                  </div>
                  <span>Clock In</span>
                </>
              )}
            </motion.button>

            {/* Recent 3 Attendance History - Compact Single Line */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <RotateCcw className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-primary font-semibold text-gray-900">Recent Attendance</h3>
              </div>

              <div className="space-y-2">
                {attendanceLoading ? (
                  <div className="text-center py-4">
                    <LoadingDots size="sm" className="mb-2" />
                    <p className="text-xs text-gray-500 font-secondary">Loading...</p>
                  </div>
                ) : recentAttendance.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-gray-500 font-secondary">No attendance records yet</p>
                  </div>
                ) : (
                  recentAttendance.slice(0, 3).map((record, index) => (
                    <motion.div
                      key={record._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-1 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`p-1.5 rounded ${record.clockOut ? 'bg-green-100' : 'bg-yellow-100'}`}>
                          <CheckCircle className={`w-3.5 h-3.5 ${record.clockOut ? 'text-green-600' : 'text-yellow-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-gray-900 font-semibold">{formatDate(record.date)}</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600 font-bold">{formatTimeOnly(record.clockIn)}</span>
                            {record.clockOut && (
                              <>
                                <span className="text-gray-400">-</span>
                                <span className="text-gray-600 font-bold">{formatTimeOnly(record.clockOut)}</span>
                              </>
                            )}
                            {record.clockOut && (
                              <>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600 font-bold">
                                  {calculateDuration(record.clockIn, record.clockOut)}
                                </span>
                              </>
                            )}
                            {!record.clockOut && (
                              <span className="text-yellow-600 font-bold ml-1">(Active)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Calendar Widget - Desktop */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative bg-white rounded-md shadow-lg overflow-hidden border border-gray-200 h-full"
        >
          <div className="p-2.5 h-full flex flex-col">
            {/* Calendar Header with Navigation - Ultra Compact */}
            <div className="flex items-center justify-between mb-2 p-2 bg-gray-100 rounded-lg">
              <button
                onClick={prevMonth}
                className="p-0.5 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronLeft className="w-3 h-3 text-gray-600" />
              </button>
              <div className="text-center flex-1">
                <h4 className="text-[18px] font-primary font-bold text-gray-900">
                  {format(currentMonth, 'MMM yyyy')}
                </h4>
              </div>
              <button
                onClick={nextMonth}
                className="p-0.5 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronRight className="w-3 h-3 text-gray-600" />
              </button>
            </div>

            {/* Calendar Grid - Ultra Compact */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Day Headers - Ultra Compact */}
              <div className="grid grid-cols-7 gap-0 mb-2">
                {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((day) => (
                  <div
                    key={day}
                    className="text-center text-[12px] text-gray-400 font-bold"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days - Ultra Compact */}
              <div className="grid grid-cols-7 gap-0.5 flex-1">
                {calendarDays.map((day, idx) => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, selectedDate);
                  const hasEvent = calendarEvents[dayKey] && calendarEvents[dayKey].length > 0;
                  
                  // Selected date or today gets green circle
                  const isHighlighted = isSelected || isToday;

                  const handleDateClick = () => {
                    setSelectedDate(day);
                    if (hasEvent) {
                      setSelectedEventDate(day);
                      setSelectedEventDetails(calendarEvents[dayKey]);
                      setShowEventPopup(true);
                    }
                  };

                  return (
                    <motion.button
                      key={idx}
                      onClick={handleDateClick}
                      whileTap={{ scale: 0.9 }}
                      className={`
                        relative rounded text-[12px] font-semibold p-1
                        ${!isCurrentMonth ? 'text-gray-200' : isHighlighted ? 'text-white' : 'text-gray-700 bg-gray-100'}
                        ${isHighlighted ? 'bg-green-500 font-semibold' : ''}
                        ${!isHighlighted && isCurrentMonth ? 'hover:bg-gray-50 active:bg-gray-100' : ''}
                      `}
                    >
                      <span className="relative z-10 leading-none">{format(day, 'd')}</span>
                      {/* Event/Festival Dot - Upper Right Corner */}
                      {hasEvent && !isHighlighted && (
                        <div className="absolute top-0 right-0">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        </div>
                      )}
                      {/* Event dot for highlighted dates */}
                      {hasEvent && isHighlighted && (
                        <div className="absolute top-0 right-0">
                          <div className="w-1.5 h-1.5 bg-white rounded-full border border-green-600"></div>
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Event/Festival Popup */}
      <AnimatePresence>
          {showEventPopup && selectedEventDate && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowEventPopup(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              />
              
              {/* Popup - Centered on Mobile and Desktop */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
                animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
                className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-md shadow-2xl border border-gray-200 overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <CalendarIcon className="w-4 h-4 text-white flex-shrink-0" />
                      <h3 className="text-xs md:text-sm font-semibold text-white font-primary truncate">
                        {format(selectedEventDate, 'EEEE, MMM dd, yyyy')}
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowEventPopup(false)}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  {/* Event Details */}
                  <div className="p-4 max-h-[60vh] md:max-h-64 overflow-y-auto">
                    {selectedEventDetails.length > 0 ? (
                      <div className="space-y-3">
                        {selectedEventDetails.map((event, idx) => (
                          <div key={idx} className="border-l-2 border-green-500 pl-3">
                            <h4 className="text-sm md:text-base font-semibold text-gray-900 font-primary mb-1">
                              {event.summary}
                            </h4>
                            {event.description && cleanDescription(event.description) && (
                              <p className="text-xs md:text-sm text-gray-600 font-secondary leading-relaxed mt-1">
                                {(() => {
                                  const cleanedDesc = cleanDescription(event.description);
                                  return cleanedDesc.length > 200 
                                    ? `${cleanedDesc.substring(0, 200)}...` 
                                    : cleanedDesc;
                                })()}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 font-secondary text-center py-4">
                        No event details available
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
    </>
  );
}

