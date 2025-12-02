'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import TimeTrackingWidget from '@/components/TimeTrackingWidget';
import { Calendar, Clock, Users, CalendarX } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import UserAvatar from '@/components/UserAvatar';
import LoadingDots from '@/components/LoadingDots';
import AnnouncementManagement from '@/components/AnnouncementManagement';
import NotClockedInModal from '@/components/NotClockedInModal';

export default function HRDashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    employeeCount: 0,
    hrCount: 0,
    pendingLeaves: 0,
    clockedInToday: 0,
    onLeaveToday: 0,
    weeklyOffToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showNotClockedInModal, setShowNotClockedInModal] = useState(false);

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
        totalEmployees: data.totalEmployees || 0,
        employeeCount: data.employeeCount || 0,
        hrCount: data.hrCount || 0,
        pendingLeaves: data.pendingLeaves || 0,
        clockedInToday: data.clockedInToday || 0,
        onLeaveToday: data.onLeaveToday || 0,
        weeklyOffToday: data.weeklyOffToday || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate percentages for each stat
  const totalEmployees = stats.totalEmployees || 1; // Avoid division by zero

  const statCards = [
    {
      title: 'Total Employees & HR',
      value: stats.totalEmployees,
      icon: Users,
      bgColor: 'bg-yellow-100',
      iconBg: 'bg-yellow-500',
      percentage: 100, // Always 100% for total
      trend: 'up' as 'up' | 'down',
      onClick: undefined as (() => void) | undefined,
    },
    {
      title: 'Clocked In Today',
      value: stats.clockedInToday,
      icon: Clock,
      bgColor: 'bg-teal-100',
      iconBg: 'bg-teal-500',
      percentage: totalEmployees > 0 ? Math.round((stats.clockedInToday / totalEmployees) * 100) : 0,
      trend: 'up' as 'up' | 'down',
      onClick: () => setShowNotClockedInModal(true),
    },
    {
      title: 'Pending Leaves',
      value: stats.pendingLeaves,
      icon: Calendar,
      bgColor: 'bg-pink-100',
      iconBg: 'bg-pink-500',
      percentage: totalEmployees > 0 ? Math.round((stats.pendingLeaves / totalEmployees) * 100) : 0,
      trend: 'down' as 'up' | 'down',
      onClick: undefined as (() => void) | undefined,
    },
    {
      title: 'On Leave Today',
      value: stats.onLeaveToday,
      icon: CalendarX,
      bgColor: 'bg-blue-100',
      iconBg: 'bg-blue-500',
      percentage: totalEmployees > 0 ? Math.round((stats.onLeaveToday / totalEmployees) * 100) : 0,
      trend: 'down' as 'up' | 'down',
      onClick: () => router.push('/hr/attendance?filter=leave'),
    },
    {
      title: 'Weekly Off Today',
      value: stats.weeklyOffToday,
      icon: Clock,
      bgColor: 'bg-purple-100',
      iconBg: 'bg-purple-500',
      percentage: totalEmployees > 0 ? Math.round((stats.weeklyOffToday / totalEmployees) * 100) : 0,
      trend: 'down' as 'up' | 'down',
      onClick: () => router.push('/hr/attendance?filter=weekOff'),
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

          {/* Time Tracking Widget and Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <TimeTrackingWidget />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={stat.onClick}
                  className={`${stat.bgColor} rounded-xl shadow-md p-6 hover:shadow-lg transition-all ${stat.onClick ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`${stat.iconBg} p-3 rounded-full shadow-sm`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 font-secondary mb-2 font-semibold">{stat.title}</p>
                    {loading ? (
                      <div className="h-10 flex items-center">
                        <LoadingDots size="md" />
                      </div>
                    ) : (
                      <>
                        <p className="text-3xl font-primary font-bold text-gray-900 mb-2">{stat.value}</p>
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-semibold font-secondary ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                            {stat.trend === 'up' ? '↑' : '↓'} {stat.percentage}%
                          </span>
                          <span className="text-xs text-gray-600 font-secondary">
                            {stat.trend === 'up' ? 'Increase' : 'Decrease'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
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

      {/* Not Clocked In Modal */}
      <NotClockedInModal
        isOpen={showNotClockedInModal}
        onClose={() => setShowNotClockedInModal(false)}
      />
    </DashboardLayout>
  );
}

