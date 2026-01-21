'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Notification {
  _id: string;
  type: 'leave_approved' | 'leave_rejected';
  title: string;
  message: string;
  leaveId?: {
    startDate: string;
    endDate: string;
    days: number;
    leaveType?: { name: string };
    reason?: string;
    status: string;
  };
  createdAt: string;
}

export default function LeaveNotificationAlert() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications (fallback only; keep modest)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    }, 15000);

    // Listen for custom event when leave is approved/rejected
    const handleLeaveStatusChange = () => {
      setTimeout(() => fetchNotifications(), 500);
    };
    
    window.addEventListener('leaveStatusChanged', handleLeaveStatusChange);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('leaveStatusChanged', handleLeaveStatusChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (notificationId: string) => {
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
      });

      if (res.ok) {
        setNotifications(notifications.filter((n) => n._id !== notificationId));
      }
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  };

  if (loading || notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[10000] px-4 pt-2">
      <div className="w-full space-y-2">
        <AnimatePresence>
          {notifications.map((notification) => {
            const leaveType = notification.leaveId?.leaveType 
              ? (typeof notification.leaveId.leaveType === 'object' ? notification.leaveId.leaveType.name : notification.leaveId.leaveType)
              : 'Leave';
            const days = notification.leaveId?.days || 0;
            const daysText = days === 0.5 
              ? '0.5 day' 
              : days < 1 
              ? `${days.toFixed(2)} day` 
              : `${days} ${days === 1 ? 'day' : 'days'}`;
            const dateRange = notification.leaveId 
              ? `${format(new Date(notification.leaveId.startDate), 'MMM dd')} - ${format(new Date(notification.leaveId.endDate), 'MMM dd')}`
              : '';

            return (
              <motion.div
                key={notification._id}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`w-full rounded-lg shadow-lg border-1 ${
                  notification.type === 'leave_approved'
                    ? 'bg-green-400/50 backdrop-blur-md border-green-700'
                    : 'bg-red-500/50 backdrop-blur-md border-red-300'
                }`}
              >
                <div className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      {notification.type === 'leave_approved' ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <XCircle className="w-5 h-5 text-white" />
                      )}
                    </div>

                    {/* Content - Single Line */}
                    <div className="flex-1 min-w-0 flex items-center gap-2 text-white">
                      {notification.type === 'leave_approved' ? (
                        <span className="text-sm font-secondary truncate">
                          🎉 Congratulations! your {daysText} leave are approved {dateRange}
                        </span>
                      ) : (
                        <span className="text-sm font-secondary truncate">
                          Your leave {daysText} leave Rejected {dateRange}
                        </span>
                      )}
                    </div>

                    {/* Close Button */}
                    <button
                      onClick={() => handleDismiss(notification._id)}
                      className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center text-white"
                      aria-label="Dismiss notification"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
