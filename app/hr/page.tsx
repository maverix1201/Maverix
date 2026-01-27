'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import TimeTrackingWidget from '@/components/TimeTrackingWidget';
import { Calendar, Clock, Users, CalendarX, UserCog, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import UserAvatar from '@/components/UserAvatar';
import LoadingDots from '@/components/LoadingDots';
import dynamic from 'next/dynamic';
const AnnouncementManagement = dynamic(() => import('@/components/AnnouncementManagement'), { ssr: false });
const NotClockedInModal = dynamic(() => import('@/components/NotClockedInModal'), { ssr: false });
const EmployeeSearch = dynamic(() => import('@/components/EmployeeSearch'), { ssr: false });
const RecentActivity = dynamic(() => import('@/components/RecentActivity'), { ssr: false });
const UpcomingBirthdays = dynamic(() => import('@/components/UpcomingBirthdays'), { ssr: false });
const PayslipGenerationModal = dynamic(() => import('@/components/PayslipGenerationModal'), { ssr: false });
import { formatDistanceToNow } from 'date-fns';

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
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [recentTeams, setRecentTeams] = useState<RecentTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);

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
    fetchStats(true);
    fetchRecentTeams(true);
    if (session) {
      fetchProfileImage();
    }

    // Auto-refresh teams (light refresh) - keep this modest to reduce load
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchRecentTeams(false);
      }
    }, 30000);

    // Refetch when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStats(false);
        fetchRecentTeams(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Refetch when window gains focus
    const handleFocus = () => {
      fetchStats(false);
      fetchRecentTeams(false);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session, fetchProfileImage]);

  const fetchStats = async (showSpinner: boolean) => {
    try {
      if (showSpinner) setLoading(true);
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
      if (showSpinner) setLoading(false);
    }
  };

  const fetchRecentTeams = async (showSpinner: boolean) => {
    try {
      if (showSpinner) setTeamsLoading(true);
      const res = await fetch('/api/teams/recent');
      const data = await res.json();
      if (res.ok) {
        setRecentTeams(data.teams || []);
      }
    } catch (err) {
      console.error('Error fetching recent teams:', err);
    } finally {
      if (showSpinner) setTeamsLoading(false);
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
          <div className="flex items-center justify-between gap-4 flex-wrap bg-primary-500 p-3 rounded-xl shadow-md">
            <div className="flex items-center gap-2">
              <UserAvatar
                name={session?.user?.name || ''}
                image={profileImage || (session?.user as any)?.profileImage}
                size="lg"
              />
              <div>
                <h1 className="text-2xl font-primary font-bold text-white">HR Dashboard</h1>
                <p className="text-sm text-gray-400 mt-0.5 font-secondary">Welcome back, <span className='font-bold text-lg text-secondary'>{session?.user?.name?.split(' ')[0] || session?.user?.name}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-full md:w-auto min-w-[280px] max-w-md">
                <EmployeeSearch />
              </div>
              <button
                onClick={() => setShowPayslipModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white text-primary-600 rounded-lg shadow-md hover:shadow-lg transition-all font-secondary text-sm font-semibold"
              >
                <FileText className="w-4 h-4" />
                Generate Payslip
              </button>
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
              className="bg-white rounded-md border border-gray-100 shadow-lg w-full h-[400px] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between flex-shrink-0 p-3 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-100 rounded-md">
                    <UserCog className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-primary font-bold text-gray-900">Recent Teams</h2>
                    <p className="text-[9px] text-gray-500 font-secondary mt-0.5">
                      {recentTeams.length} {recentTeams.length === 1 ? 'team' : 'teams'} • Active groups
                    </p>
                  </div>
                </div>
                <div className="px-2.5 py-1 bg-purple-100 rounded-full flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs font-bold text-purple-700 font-primary">
                    {recentTeams.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
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
                  <div className="space-y-1.5">
                    {recentTeams.map((team, index) => {
                      // Format time in short format
                      const formatShortTime = (timestamp: string): string => {
                        const now = new Date();
                        const time = new Date(timestamp);
                        const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);
                        
                        if (diffInSeconds < 60) {
                          return `${diffInSeconds}s ago`;
                        } else if (diffInSeconds < 3600) {
                          const minutes = Math.floor(diffInSeconds / 60);
                          return `${minutes}m ago`;
                        } else if (diffInSeconds < 86400) {
                          const hours = Math.floor(diffInSeconds / 3600);
                          return `${hours}h ago`;
                        } else {
                          const days = Math.floor(diffInSeconds / 86400);
                          return `${days}d ago`;
                        }
                      };

                      return (
                        <motion.a
                          key={team._id}
                          href="/hr/teams"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="group rounded-md transition-all duration-200 p-4 relative bg-white hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            {/* Avatar with badge */}
                            <div className="relative flex-shrink-0">
                              <UserAvatar
                                name={team.leader?.name || 'No Leader'}
                                image={team.leader?.profileImage || null}
                                size="sm"
                              />
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-purple-500 rounded-full border-2 border-white"></div>
                            </div>
                            
                            {/* Team Name and Members */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-900 font-primary leading-tight">
                                  {team.name}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 rounded-md">
                                    <Users className="w-2.5 h-2.5 text-purple-700" />
                                    <span className="text-[10px] font-bold text-purple-700 font-secondary">
                                      {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Time */}
                            <div className="flex-shrink-0 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <span className="text-[10px] text-gray-500 font-secondary whitespace-nowrap">
                                {formatShortTime(team.createdAt)}
                              </span>
                            </div>
                          </div>
                        </motion.a>
                      );
                    })}
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

      {/* Payslip Generation Modal */}
      <PayslipGenerationModal
        isOpen={showPayslipModal}
        onClose={() => setShowPayslipModal(false)}
      />
    </DashboardLayout>
  );
}

