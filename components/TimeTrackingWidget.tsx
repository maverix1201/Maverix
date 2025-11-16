'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, LogIn, LogOut, CheckCircle, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
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

    return () => {
      clearInterval(timeInterval);
      clearInterval(statusInterval);
    };
  }, []);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl shadow-2xl overflow-hidden border border-white/10"
    >
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>
      </div>

      {/* Time Tracking Section */}
      <div className="relative p-3 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-md border border-white/30">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-primary font-bold">Start Your Day</h2>
              {clockedIn && (
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                  <span className="text-[10px] font-secondary text-white/90 font-medium">Live</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleClockInOut}
            disabled={loading}
            className={`px-4 py-2 rounded-lg font-semibold text-xs transition-all shadow-lg backdrop-blur-md border flex items-center gap-1.5 ${clockedIn
              ? 'bg-red-500/90 hover:bg-red-600 text-white border-red-400/50'
              : 'bg-white/95 hover:bg-white text-primary border-white/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <LoadingDots size="sm" color={clockedIn ? 'white' : 'primary'} />
            ) : clockedIn ? (
              <>
                <LogOut className="w-3.5 h-3.5" />
                Clock Out
              </>
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5" />
                Clock In
              </>
            )}
          </button>
        </div>

        <div className="mb-3">
          {clockedIn && clockInTime ? (
            <p className="text-xs font-secondary text-white/90">
              Clocked in at <span className="font-semibold">{formatTime(clockInTime)}</span>
            </p>
          ) : (
            <p className="text-xs font-secondary text-white/90">Have a great day!</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/20">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-white/80" />
            <span className="text-xs font-secondary text-white/90 font-medium">
              {mounted && currentTime ? formatTime(currentTime) : '--:--:--'}
            </span>
          </div>
          <span className="text-xs font-secondary text-white/80">
            {mounted && currentTime ? formatDate(currentTime) : '--- --, ----'}
          </span>
        </div>
      </div>

      {/* Recent Attendance Section */}
      <div className="relative bg-white/5 backdrop-blur-md border-t border-white/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <RotateCcw className="w-4 h-4 text-white/90" />
          <h3 className="text-sm font-primary font-semibold text-white">Recent 3 Attendance</h3>
        </div>

        <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-white pr-1.5">
          {attendanceLoading ? (
            <div className="text-center py-6">
              <LoadingDots size="sm" color="white" className="mb-2" />
              <p className="text-xs text-white/70 font-secondary">Loading...</p>
            </div>
          ) : recentAttendance.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-white/70 font-secondary">No records yet</p>
            </div>
          ) : (
            recentAttendance.map((record, index) => (
              <motion.div
                key={record._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 border border-white/15 hover:bg-white/15 hover:border-white/25 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">

                  <div className="flex items-start justify-start w-auto gap-2">
                    <div className="p-1.5 bg-green-500 rounded-3xl flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white-800" />
                    </div>
                    <div className="flex flex-col items-start justify-start w-auto gap-1">
                      <p className="text-xs font-semibold text-white font-primary text-left">
                        {formatDate(record.date)}
                      </p>
                      <p className="text-xs text-white/70 font-secondary text-left">Work Session</p>
                    </div>
                  </div>

                  <div className="w-auto flex flex-col items-end justify-start gap-1">
                    <p className="flex items-center gap-2 text-xs text-white/90 font-secondary font-medium">
                      {formatTime(record.clockIn)} {record.clockOut ? `- ${formatTime(record.clockOut)}` : <span className="text-yellow-300">(Active)</span>}
                    </p>
                    {record.clockOut && (
                      <p className="flex items-center gap-2 text-xs text-white/60 font-secondary">
                        <Clock className="w-3.5 h-3.5 text-white/60" />
                        Total: {calculateDuration(record.clockIn, record.clockOut)}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </motion.div >
  );
}

