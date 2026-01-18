'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle, XCircle, AtSign, X, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import UserAvatar from './UserAvatar';

interface Notification {
  _id: string;
  type: 'leave_approved' | 'leave_rejected' | 'mention';
  title: string;
  message: string;
  leaveId?: {
    startDate: string;
    endDate: string;
    days: number;
    leaveType?: string;
  };
  feedId?: {
    _id: string;
    content: string;
    createdAt: string;
  };
  mentionedBy?: {
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
  };
  read: boolean;
  createdAt: string;
}

interface NotificationDropdownProps {
  onClose?: () => void;
}

export default function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetchNotifications();

    // Poll for new notifications every 5 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 5000);

    // Listen for custom event when leave is approved/rejected
    const handleLeaveStatusChange = () => {
      setTimeout(() => fetchNotifications(), 500);
    };

    window.addEventListener('leaveStatusChanged', handleLeaveStatusChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('leaveStatusChanged', handleLeaveStatusChange);
    };
  }, []);

  // Removed click-outside functionality - dropdown will only close via close button

  const fetchNotifications = async () => {
    try {
      // Always fetch 10 most recent notifications (not dismissed)
      const res = await fetch(`/api/notifications?limit=10&includeDismissed=false&t=${Date.now()}`);
      const data = await res.json();
      if (res.ok) {
        // Ensure we only show 10 notifications
        const previousNotifications = notifications;
        const newNotifications = (data.notifications || []).slice(0, 10);
        
        // Check for new unread notifications to show push notification
        if (previousNotifications.length > 0) {
          const previousIds = new Set(previousNotifications.map((n: Notification) => n._id));
          const newUnreadNotifications = newNotifications.filter(
            (n: Notification) => !n.read && !previousIds.has(n._id)
          );
          
          // Show push notification for new unread notifications
          if (newUnreadNotifications.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
            newUnreadNotifications.forEach((notification: Notification) => {
              // Use direct Notification API
              new Notification(notification.title, {
                body: notification.message,
                icon: '/assets/maverixicon.png',
                badge: '/assets/maverixicon.png',
                tag: `notification-${notification._id}`,
                data: {
                  notificationId: notification._id,
                  type: notification.type,
                  url: notification.type === 'mention' ? '/employee/feed' : 
                       (notification.type === 'leave_approved' || notification.type === 'leave_rejected') ? '/employee/leaves' : '/',
                },
              });
            });
          }
        }
        
        setNotifications(newNotifications);
        setUnreadCount(newNotifications.filter((n: Notification) => !n.read).length || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });

      if (res.ok) {
        setNotifications(notifications.map(n =>
          n._id === notificationId ? { ...n, read: true } : n
        ));
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    handleMarkAsRead(notification._id);

    if (notification.type === 'mention' && notification.feedId) {
      router.push('/employee/feed');
      if (onClose) onClose();
    } else if (notification.type === 'leave_approved' || notification.type === 'leave_rejected') {
      router.push('/employee/leaves');
      if (onClose) onClose();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'leave_approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'leave_rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'mention':
        return <AtSign className="w-4 h-4 text-blue-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'leave_approved':
        return 'bg-green-50 border-green-200';
      case 'leave_rejected':
        return 'bg-red-50 border-red-200';
      case 'mention':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div
      className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[500px] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="text-base font-primary font-bold text-gray-800">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
            <p className="text-xs text-gray-500 mt-2 font-secondary">Loading...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center">
            <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-secondary">No notifications</p>
          </div>
        ) : (
          <div className="p-1.5 space-y-1.5">
            {notifications.map((notification) => (
              <motion.div
                key={notification._id}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleNotificationClick(notification)}
                className={`relative p-2 rounded-lg cursor-pointer transition-all shadow-sm hover:shadow-md ${!notification.read
                    ? 'bg-white border border-primary/20'
                    : 'bg-gray-50/50 border border-transparent'
                  }`}
              >
                <div className="flex items-start gap-2">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {notification.type === 'mention' && notification.mentionedBy ? (
                      <div className="relative">
                        <UserAvatar
                          name={notification.mentionedBy.name}
                          image={notification.mentionedBy.profileImage}
                          size="sm"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border border-white"></div>
                      </div>
                    ) : (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${notification.type === 'leave_approved'
                          ? 'bg-green-100'
                          : notification.type === 'leave_rejected'
                            ? 'bg-red-100'
                            : 'bg-blue-100'
                        }`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] leading-tight font-secondary ${!notification.read ? 'text-gray-900 font-medium' : 'text-gray-600'
                      }`}>
                      {notification.message}
                    </p>
                    {notification.type === 'mention' && notification.feedId && notification.feedId.content && (
                      <p className="text-[10px] text-gray-500 mt-0.5 font-secondary italic line-clamp-1 bg-gray-100/50 px-1 py-0.5 rounded">
                        &quot;{notification.feedId.content.substring(0, 35)}...&quot;
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 font-secondary">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>

                  {/* Unread Indicator */}
                  {!notification.read && (
                    <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

