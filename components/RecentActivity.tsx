'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Calendar, LogIn, LogOut, Activity } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';

interface Activity {
  type: 'clockIn' | 'clockOut' | 'leaveRequest';
  id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
  };
  timestamp: string;
  details: {
    date?: string;
    leaveType?: string;
    status?: string;
  };
}

export default function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for real-time time display
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    fetchActivities(true);

    // Auto-refresh activities (light refresh) - keep this modest
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchActivities(false);
      }
    }, 30000);

    // Refetch when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchActivities(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Refetch when window gains focus
    const handleFocus = () => {
      fetchActivities(false);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchActivities = async (showSpinner: boolean) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await fetch(`/api/admin/recent-activities?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json();
      if (res.ok) {
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Error fetching recent activities:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'clockIn':
        return <LogIn className="w-3.5 h-3.5 text-green-600" />;
      case 'clockOut':
        return <LogOut className="w-3.5 h-3.5 text-red-600" />;
      case 'leaveRequest':
        return <Calendar className="w-3.5 h-3.5 text-blue-600" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-gray-600" />;
    }
  };

  const getActivityText = (activity: Activity) => {
    switch (activity.type) {
      case 'clockIn':
        return 'clocked in';
      case 'clockOut':
        return 'clocked out';
      case 'leaveRequest':
        return `requested ${activity.details.leaveType || 'leave'}`;
      default:
        return 'performed an action';
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return '';
    switch (status) {
      case 'approved':
        return 'text-green-600';
      case 'rejected':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  // Format time as HH:MM (since all activities are from today)
  const formatShortTime = (timestamp: string): string => {
    const time = new Date(timestamp);
    return format(time, 'HH:mm');
  };

  return (
    <div className="bg-white rounded-md border border-gray-100 shadow-lg w-full h-[400px] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0 p-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 rounded-md">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-primary font-bold text-gray-900">Recent Activity</h2>
            <p className="text-[9px] text-gray-500 font-secondary mt-0.5">
              {format(new Date(), 'MMMM d, yyyy')} • {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
            </p>
          </div>
        </div>
        <div className="px-2.5 py-1 bg-blue-100 rounded-full flex items-center gap-1 flex-shrink-0">
          <span className="text-xs font-bold text-blue-700 font-primary">
            {activities.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {loading && activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingDots size="lg" className="mb-2" />
            <p className="text-sm text-gray-500 font-secondary mt-2">Loading activities...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <Activity className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-base font-primary font-semibold text-gray-600 mb-1">No activities today</p>
            <p className="text-sm text-gray-500 font-secondary">Today&apos;s activities will appear here</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {activities.map((activity, index) => {
              const isClockIn = activity.type === 'clockIn';
              const isClockOut = activity.type === 'clockOut';
              
              // Skip activities with null/undefined userId
              if (!activity.userId) {
                return null;
              }
              
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`group rounded-md transition-all duration-200 p-4 relative ${
                    isClockIn 
                      ? 'bg-gray-50 hover:bg-gray-100' 
                      : isClockOut
                      ? 'bg-gray-50 hover:bg-gray-100'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${
                      isClockIn 
                        ? 'bg-green-100' 
                        : isClockOut
                        ? 'bg-red-100'
                        : 'bg-blue-100'
                    }`}>
                      {isClockIn ? (
                        <LogIn className="w-3.5 h-3.5 text-green-600" />
                      ) : isClockOut ? (
                        <LogOut className="w-3.5 h-3.5 text-red-600" />
                      ) : (
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </div>
                    
                    {/* Profile Avatar */}
                    <UserAvatar
                      name={activity.userId?.name || 'Unknown User'}
                      image={activity.userId?.profileImage}
                      size="sm"
                      className="flex-shrink-0"
                    />
                    
                    {/* Name and Status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-900 font-primary leading-tight">
                          {activity.userId?.name || 'Unknown User'}
                        </span>
                        <span className="text-[10px] text-gray-500 font-secondary leading-tight">
                          {getActivityText(activity)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Time */}
                    <div className="flex-shrink-0">
                      <span className="text-[10px] text-gray-500 font-secondary whitespace-nowrap">
                        {formatShortTime(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

