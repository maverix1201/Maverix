'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Calendar, LogIn, LogOut, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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

  useEffect(() => {
    fetchActivities();
    
    // Auto-refresh activities every 5 seconds
    const interval = setInterval(() => {
      fetchActivities();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/recent-activities');
      const data = await res.json();
      if (res.ok) {
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Error fetching recent activities:', err);
    } finally {
      setLoading(false);
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

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 w-full h-[500px] flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-primary font-semibold text-gray-800">Recent Activity</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {loading && activities.length === 0 ? (
          <div className="text-center py-8">
            <LoadingDots size="lg" className="mb-2" />
            <p className="text-sm text-gray-500 font-secondary mt-2">Loading activities...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-secondary">No recent activities</p>
          </div>
        ) : (
          <div className="space-y-3 pr-2">
            {activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200/50 hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <UserAvatar
                      name={activity.userId.name}
                      image={activity.userId.profileImage}
                      size="sm"
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 font-secondary leading-relaxed">
                        <span className="font-semibold">{activity.userId.name}</span>{' '}
                        {getActivityText(activity)}
                        {activity.details.status && (
                          <span className={`ml-1 font-medium ${getStatusColor(activity.details.status)}`}>
                            ({activity.details.status})
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-500 font-secondary mt-0.5">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

