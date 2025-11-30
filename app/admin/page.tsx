'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Users, Calendar, DollarSign, Clock, UserCog } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import UserAvatar from '@/components/UserAvatar';
import { formatDistanceToNow } from 'date-fns';
import LoadingDots from '@/components/LoadingDots';
import RecentActivity from '@/components/RecentActivity';
import AnnouncementManagement from '@/components/AnnouncementManagement';
import PendingEmployees from '@/components/PendingEmployees';
import NotClockedInModal from '@/components/NotClockedInModal';

interface RecentTeam {
  _id: string;
  name: string;
  description?: string;
  leader: {
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
  };
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
    pendingLeaves: 0,
    pendingPayments: 0,
    clockedInToday: 0,
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
      router.push('/login');
      return;
    }

    if (session) {
      const userRole = (session.user as any)?.role;
      if (userRole !== 'admin') {
        // Redirect to correct dashboard
        if (userRole === 'hr') {
          router.push('/hr');
        } else if (userRole === 'employee') {
          router.push('/employee');
        } else {
          router.push('/login');
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

      return () => clearInterval(interval);
    }
  }, [session, status]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      setStats({
        totalEmployees: data.totalEmployees || 0,
        pendingLeaves: data.pendingLeaves || 0,
        pendingPayments: data.pendingPayments || 0,
        clockedInToday: data.clockedInToday || 0,
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
      const res = await fetch('/api/teams/recent');
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

  const statCards = [
    {
      title: 'Total Employees',
      value: stats.totalEmployees,
      icon: Users,
      gradient: 'from-blue-500 to-blue-600',
      onClick: undefined as (() => void) | undefined,
    },
    {
      title: 'Clocked In Today',
      value: stats.clockedInToday,
      icon: Clock,
      gradient: 'from-purple-500 to-purple-600',
      onClick: () => setShowNotClockedInModal(true),
    },
    {
      title: 'Pending Leaves',
      value: stats.pendingLeaves,
      icon: Calendar,
      gradient: 'from-yellow-500 to-yellow-600',
      onClick: undefined as (() => void) | undefined,
    },
    {
      title: 'Pending Payments',
      value: stats.pendingPayments,
      icon: DollarSign,
      gradient: 'from-green-500 to-green-600',
      onClick: undefined as (() => void) | undefined,
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
          <div className="flex items-center gap-2">
            <UserAvatar
              name={session?.user?.name || ''}
              image={profileImage || (session?.user as any)?.profileImage}
              size="lg"
            />
            <div>
              <h1 className="text-2xl font-primary font-bold text-gray-800">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-0.5 font-secondary">Welcome back, {session?.user?.name}</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={stat.onClick}
                  className={`bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50 hover:shadow-xl transition-shadow ${
                    stat.onClick ? 'cursor-pointer' : ''
                  }`}
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

          {/* Pending Employees */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <PendingEmployees />
          </motion.div>

          {/* Recent Activity and Recent Teams */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="w-full lg:w-[350px]"
            >
              <RecentActivity />
            </motion.div>

            {/* Recent Teams Created */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 w-full lg:w-[350px] h-[500px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <UserCog className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-primary font-semibold text-gray-800">Recent Teams</h2>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {teamsLoading && recentTeams.length === 0 ? (
                  <div className="text-center py-8">
                    <LoadingDots size="lg" className="mb-2" />
                    <p className="text-sm text-gray-500 font-secondary mt-2">Loading teams...</p>
                  </div>
                ) : recentTeams.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 font-secondary">No teams created yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 pr-2">
                    {recentTeams.map((team, index) => (
                      <motion.a
                        key={team._id}
                        href="/admin/teams"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="block p-3 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200/50 hover:border-primary/30 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <UserAvatar
                              name={team.leader.name}
                              image={team.leader.profileImage}
                              size="sm"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-primary font-semibold text-gray-800 truncate group-hover:text-primary transition-colors">
                              {team.name}
                            </h3>
                            {team.description && (
                              <p className="text-xs text-gray-600 font-secondary mt-0.5 line-clamp-1">
                                {team.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              <div className="flex items-center gap-1">
                                <Users className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500 font-secondary">
                                  {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-500 font-secondary">
                                {formatDistanceToNow(new Date(team.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.a>
                    ))}
                  </div>
                )}
              </div>
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

