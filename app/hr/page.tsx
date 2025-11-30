'use client';

import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/DashboardLayout';
import TimeTrackingWidget from '@/components/TimeTrackingWidget';
import { Calendar, Clock, DollarSign, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import UserAvatar from '@/components/UserAvatar';
import LoadingDots from '@/components/LoadingDots';
import AnnouncementManagement from '@/components/AnnouncementManagement';

export default function HRDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState({
    pendingLeaves: 0,
    todayAttendance: 0,
    approvedLeaves: 0,
  });
  const [loading, setLoading] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const fetchProfileImage = useCallback(async () => {
    try {
      // First check if profileImage is in session
      const sessionImage = (session?.user as any)?.image || (session?.user as any)?.profileImage;
      if (sessionImage) {
        setProfileImage(sessionImage);
        return;
      }

      // If not in session, fetch it from API
      const res = await fetch('/api/profile/image');
      const data = await res.json();
      if (res.ok && data.profileImage) {
        setProfileImage(data.profileImage);
      }
    } catch (err) {
      console.error('Error fetching profile image:', err);
    }
  }, [session]);

  useEffect(() => {
    fetchStats();
    if (session) {
      fetchProfileImage();
    }
  }, [session, fetchProfileImage]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hr/stats');
      const data = await res.json();
      setStats({
        pendingLeaves: data.pendingLeaves || 0,
        todayAttendance: data.todayAttendance || 0,
        approvedLeaves: data.approvedLeaves || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Pending Leaves',
      value: stats.pendingLeaves,
      icon: Calendar,
      gradient: 'from-yellow-500 to-yellow-600',
      href: '/hr/leaves',
    },
    {
      title: 'Today Attendance',
      value: stats.todayAttendance,
      icon: Clock,
      gradient: 'from-blue-500 to-blue-600',
      href: '/hr/attendance',
    },
    {
      title: 'Approved Leaves',
      value: stats.approvedLeaves,
      icon: Calendar,
      gradient: 'from-green-500 to-green-600',
      href: '/hr/leaves',
    },
  ];

  return (
    <DashboardLayout role="hr">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="space-y-6 p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center gap-2">
            <UserAvatar
              name={session?.user?.name || ''}
              image={profileImage || (session?.user as any)?.profileImage}
              size="lg"
            />
            <div>
              <h1 className="text-2xl font-primary font-bold text-gray-800">HR Dashboard</h1>
              <p className="text-sm text-gray-600 mt-0.5 font-secondary">Welcome back, {session?.user?.name}</p>
            </div>
          </div>

          {/* Time Tracking Widget */}
          <TimeTrackingWidget />

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.a
                  key={stat.title}
                  href={stat.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50 hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 font-secondary mb-1">{stat.title}</p>
                      {loading ? (
                        <div className="h-9 flex items-center">
                          <LoadingDots size="md" />
                        </div>
                      ) : (
                        <p className="text-3xl font-primary font-bold text-gray-800">{stat.value}</p>
                      )}
                    </div>
                    <div className={`bg-gradient-to-br ${stat.gradient} p-3 rounded-xl shadow-lg`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </div>

          {/* Announcement Management */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <AnnouncementManagement />
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

