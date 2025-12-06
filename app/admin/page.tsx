'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Users, Calendar, Clock, UserCog, CalendarX, } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import UserAvatar from '@/components/UserAvatar';
import { formatDistanceToNow } from 'date-fns';
import LoadingDots from '@/components/LoadingDots';
import RecentActivity from '@/components/RecentActivity';
import AnnouncementManagement from '@/components/AnnouncementManagement';
import PendingEmployees from '@/components/PendingEmployees';
import NotClockedInModal from '@/components/NotClockedInModal';
import EmployeeSearch from '@/components/EmployeeSearch';
import UpcomingBirthdays from '@/components/UpcomingBirthdays';

interface RecentTeam {
  _id: string;
  name: string;
  description?: string;
  leader: {
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
  } | null;
  members: Array<{
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
  }>;
  createdBy: {
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
  };
  createdAt: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
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
  const [recentTeams, setRecentTeams] = useState<RecentTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showNotClockedInModal, setShowNotClockedInModal] = useState(false);

  // Verify admin role
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    if (session) {
      const userRole = (session.user as any)?.role;
      if (userRole !== 'admin') {
        // Redirect to correct dashboard
        // HR should behave as employee - redirect to employee dashboard
        if (userRole === 'hr' || userRole === 'employee') {
          router.push('/employee');
        } else {
          router.push('/');
        }
        return;
      }
    }
  }, [session, status, router]);

  useEffect(() => {
    const fetchProfileImage = async () => {
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
    };

    // Only fetch data if user is authenticated and is admin
    if (status === 'authenticated' && session && (session.user as any)?.role === 'admin') {
      fetchStats();
      fetchRecentTeams();
      fetchProfileImage();

      // Auto-refresh teams every 5 seconds
      const interval = setInterval(() => {
        fetchRecentTeams();
      }, 5000);

      // Refetch when page becomes visible (user navigates back)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          fetchStats();
          fetchRecentTeams();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Refetch when window gains focus
      const handleFocus = () => {
        fetchStats();
        fetchRecentTeams();
      };
      window.addEventListener('focus', handleFocus);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [session, status]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/stats?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
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

  const fetchRecentTeams = async () => {
    try {
      setTeamsLoading(true);
      const res = await fetch(`/api/teams/recent?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json();
      if (res.ok) {
        setRecentTeams(data.teams || []);
      }
    } catch (err) {
      console.error('Error fetching recent teams:', err);
    } finally {
      setTeamsLoading(false);
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
      onClick: () => router.push('/admin/attendance?filter=leave'),
    },
    {
      title: 'Weekly Off Today',
      value: stats.weeklyOffToday,
      icon: Clock,
      bgColor: 'bg-purple-100',
      iconBg: 'bg-purple-500',
      percentage: totalEmployees > 0 ? Math.round((stats.weeklyOffToday / totalEmployees) * 100) : 0,
      trend: 'down' as 'up' | 'down',
      onClick: () => router.push('/admin/attendance?filter=weekOff'),
    },
  ];

  // Show loading state while session is loading or role doesn't match
  if (status === 'loading' || (session && (session.user as any)?.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingDots size="lg" />
          <p className="mt-4 text-gray-600 font-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (redirect will happen in useEffect)
  if (status === 'unauthenticated' || !session) {
    return null;
  }

  return (
    <DashboardLayout role="admin">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="space-y-6 p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <UserAvatar
                name={session?.user?.name || ''}
                image={profileImage || (session?.user as any)?.profileImage}
                size="lg"
              />
              <div>
                <h1 className="text-2xl font-primary font-bold text-gray-800">Admin Dashboard</h1>
                <p className="text-sm text-gray-600 mt-0.5 font-secondary">Welcome back, {session?.user?.name?.split(' ')[0] || session?.user?.name}</p>
              </div>
            </div>
            <div className="w-full md:w-auto min-w-[280px] max-w-md">
              <EmployeeSearch />
            </div>
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
                  className={`${stat.bgColor} rounded-xl shadow-md p-6 hover:shadow-lg transition-all ${stat.onClick ? 'cursor-pointer' : ''
                    }`}
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
                          <span className={`text-xs font-semibold font-secondary ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                            }`}>
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

          {/* Announcement Management and Pending Employees Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Announcement Management */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="h-[400px] flex flex-col"
            >
              <AnnouncementManagement />
            </motion.div>

            {/* Pending Employees */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="h-[400px] flex flex-col"
            >
              <PendingEmployees />
            </motion.div>
          </div>

          {/* Recent Activity, Recent Teams, and Upcoming Birthdays */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="w-full"
            >
              <RecentActivity />
            </motion.div>

            {/* Recent Teams Created */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-lg w-full h-[500px] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between flex-shrink-0 p-5 border-b border-violet-200/50 bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg border border-white/30">
                    <UserCog className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-primary font-bold text-white">Recent Teams</h2>
                    <p className="text-xs text-white/90 font-secondary mt-0.5">
                      {recentTeams.length} {recentTeams.length === 1 ? 'team' : 'teams'} • Active groups
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {teamsLoading && recentTeams.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <LoadingDots size="lg" className="mb-2" />
                    <p className="text-sm text-gray-500 font-secondary mt-2">Loading teams...</p>
                  </div>
                ) : recentTeams.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="p-4 bg-gray-100 rounded-full mb-4">
                      <UserCog className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-base font-primary font-semibold text-gray-600 mb-1">No teams created yet</p>
                    <p className="text-sm text-gray-500 font-secondary">Create your first team to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {recentTeams.map((team, index) => (
                      <motion.a
                        key={team._id}
                        href="/admin/teams"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group block bg-white rounded-xl border border-gray-200 hover:border-violet-400 hover:shadow-xl transition-all duration-200 p-3.5 relative shadow-sm"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="relative flex-shrink-0">
                            <div className="p-1 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200">
                              <UserAvatar
                                name={team.leader?.name || 'No Leader'}
                                image={team.leader?.profileImage || null}
                                size="sm"
                              />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-br from-violet-500 to-purple-500 border-2 border-white rounded-full shadow-md"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-primary font-bold text-gray-800 truncate group-hover:text-violet-600 transition-colors mb-0.5">
                              {team.name}
                            </h3>
                            {team.description && (
                              <p className="text-xs text-gray-600 font-secondary line-clamp-1 mb-1">
                                {team.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded border border-violet-200">
                                <Users className="w-2.5 h-2.5" />
                                <span className="text-[10px] font-bold font-secondary">
                                  {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
                                </span>
                              </div>
                              <span className="text-gray-300 text-[10px]">•</span>
                              <div className="flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-gray-400" />
                                <span className="text-[10px] text-gray-500 font-secondary">
                                  {formatDistanceToNow(new Date(team.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.a>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Upcoming Birthdays */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="w-full"
            >
              <UpcomingBirthdays />
            </motion.div>
          </div>
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

