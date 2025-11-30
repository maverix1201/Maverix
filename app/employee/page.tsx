'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import EmployeeTeamInfo from '@/components/EmployeeTeamInfo';
import EmployeeSearch from '@/components/EmployeeSearch';
import TimeTrackingWidget from '@/components/TimeTrackingWidget';
import UpcomingBirthdays from '@/components/UpcomingBirthdays';
import BirthdayCelebration from '@/components/BirthdayCelebration';
import AnnouncementModal from '@/components/AnnouncementModal';
import { Clock, Calendar, Users, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/contexts/ToastContext';
import UserAvatar from '@/components/UserAvatar';
import LoadingDots from '@/components/LoadingDots';
import Logo from '@/components/Logo';
import LeaveNotificationAlert from '@/components/LeaveNotificationAlert';

export default function EmployeeDashboard() {
  const { data: session } = useSession();
  const toast = useToast();
  const [stats, setStats] = useState({
    totalLeaveTypes: 0,
    pendingLeaves: 0,
    totalInTeam: 0,
    weeklyHours: 0,
    attendanceThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showBirthdayCelebration, setShowBirthdayCelebration] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [greeting, setGreeting] = useState('🌟 Welcome');

  // Function to get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return '🌞 Good Morning';
    } else if (hour >= 12 && hour < 17) {
      return '🌇 Good Afternoon';
    } else if (hour >= 17 && hour < 22) {
      return '🌆 Good Evening';
    } else {
      return '🌙 Good Night';
    }
  };

  // Update greeting on mount and when time changes
  useEffect(() => {
    setGreeting(getGreeting());
    // Update greeting every minute to handle day transitions
    const interval = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const [leavesRes, leaveTypesRes, teamsRes, weeklyHoursRes, attendanceRes] = await Promise.all([
        fetch('/api/leave'),
        fetch('/api/leave/allotted-types'),
        fetch('/api/teams/my-team'),
        fetch('/api/attendance/weekly-hours'),
        fetch('/api/attendance/stats'),
      ]);

      const leaves = await leavesRes.json();
      const leaveTypes = await leaveTypesRes.json();
      const teams = await teamsRes.json();
      const weeklyHours = await weeklyHoursRes.json();
      const attendance = await attendanceRes.json();

      // Calculate total team members
      let totalTeamMembers = 0;
      if (teams.teams && teams.teams.length > 0) {
        teams.teams.forEach((team: any) => {
          totalTeamMembers += team.members?.length || 0;
        });
      }

      setStats({
        totalLeaveTypes: leaveTypes.leaveTypes?.length || 0,
        pendingLeaves: leaves.leaves?.filter((l: any) => l.status === 'pending' && !l.allottedBy).length || 0,
        totalInTeam: totalTeamMembers,
        weeklyHours: weeklyHours.weeklyHours || 0,
        attendanceThisMonth: attendance.attendanceThisMonth || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchUserProfile = async () => {
    try {
      // Don't include profileImage in initial fetch to prevent slow dashboard loads
      // ProfileImage will be loaded from session or fetched separately if needed
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (res.ok && data.user) {
        setUserProfile(data.user);
        
        // Check if today is the user's birthday
        if (data.user.dateOfBirth) {
          const today = new Date();
          const dob = new Date(data.user.dateOfBirth);
          const birthMonth = dob.getMonth();
          const birthDay = dob.getDate();
          
          // Check if today matches the birthday (month and day)
          if (today.getMonth() === birthMonth && today.getDate() === birthDay) {
            // Check if birthday popup has already been shown today
            const todayKey = `birthday-celebration-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
            const hasShownToday = localStorage.getItem(todayKey);
            
            // Only show if not shown today (first time opening website today)
            if (!hasShownToday) {
              setShowBirthdayCelebration(true);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

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

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements');
      const data = await res.json();
      if (res.ok && data.announcements && data.announcements.length > 0) {
        setAnnouncements(data.announcements);
        setCurrentAnnouncementIndex(0);
        setShowAnnouncement(true);
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
    }
  };

  const handleAnnouncementClose = () => {
    if (currentAnnouncementIndex < announcements.length - 1) {
      // Show next announcement
      setCurrentAnnouncementIndex(currentAnnouncementIndex + 1);
    } else {
      // All announcements shown
      setShowAnnouncement(false);
      setAnnouncements([]);
    }
  };

  const handleAnnouncementViewTracked = () => {
    // Refresh announcements to get updated view counts
    fetchAnnouncements();
  };

  useEffect(() => {
    if (session) {
      fetchStats();
      fetchUserProfile();
      fetchAnnouncements();
      fetchProfileImage();
    }
  }, [session, fetchStats, fetchProfileImage]);

  return (
    <>
      <LeaveNotificationAlert />
      <DashboardLayout role="employee">
      {/* Birthday Celebration Modal */}
      {showBirthdayCelebration && userProfile && (
        <BirthdayCelebration
          userName={userProfile.name || session?.user?.name || 'Employee'}
          userImage={userProfile.profileImage || (session?.user as any)?.profileImage}
          onClose={() => {
            // Mark as shown in localStorage for today
            const today = new Date();
            const todayKey = `birthday-celebration-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
            localStorage.setItem(todayKey, 'true');
            setShowBirthdayCelebration(false);
          }}
        />
      )}

      {/* Announcement Modal */}
      {showAnnouncement && announcements.length > 0 && announcements[currentAnnouncementIndex] && (
        <AnnouncementModal
          announcement={announcements[currentAnnouncementIndex]}
          onClose={handleAnnouncementClose}
          onViewTracked={handleAnnouncementViewTracked}
        />
      )}
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="space-y-6 p-4 md:p-6">
          {/* Logo - Mobile Only */}
          <div className="flex justify-center md:hidden mb-2">
            <Logo size="md" />
          </div>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 dashboard-header-image p-3 rounded-lg">
            <div>
              <div className="flex items-center gap-2">
                <UserAvatar
                  name={session?.user?.name || ''}
                  image={profileImage || (session?.user as any)?.profileImage}
                  size="lg"
                />
                <div>
                  <h3 className="text-md font-bold text-gray-800">{greeting}, <span className="text-secondary">{session?.user?.name}</span></h3>
                  {userProfile?.designation ? (
                    <p className="text-sm font-bold text-primary mt-1 font-secondary">
                      {userProfile.designation}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1 font-secondary italic">
                      No designation assigned
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mt-0.5 font-secondary">{session?.user?.email}</p>
                </div>
              </div>

            </div>
            <div className="w-full md:w-auto">
              <EmployeeSearch />
            </div>
          </div>

          {/* Time Tracking Widget */}
          <TimeTrackingWidget />

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-secondary mb-1">Total Leave Types</p>
                  {loading ? (
                    <div className="h-9 flex items-center">
                      <LoadingDots size="md" />
                    </div>
                  ) : (
                    <p className="text-3xl font-primary font-bold text-gray-800">{stats.totalLeaveTypes}</p>
                  )}
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-secondary mb-1">Pending Leaves</p>
                  {loading ? (
                    <div className="h-9 flex items-center">
                      <LoadingDots size="md" />
                    </div>
                  ) : (
                    <p className="text-3xl font-primary font-bold text-gray-800">{stats.pendingLeaves}</p>
                  )}
                </div>
                <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-3 rounded-xl shadow-lg">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-secondary mb-1">Total in Team</p>
                  {loading ? (
                    <div className="h-9 flex items-center">
                      <LoadingDots size="md" />
                    </div>
                  ) : (
                    <p className="text-3xl font-primary font-bold text-gray-800">{stats.totalInTeam}</p>
                  )}
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-xl shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-secondary mb-1">Working Hours (Week)</p>
                  {loading ? (
                    <div className="h-9 flex items-center">
                      <LoadingDots size="md" />
                    </div>
                  ) : (
                    <p className="text-3xl font-primary font-bold text-gray-800">{stats.weeklyHours}</p>
                  )}
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-3 rounded-xl shadow-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Side Section - Team Info and Upcoming Birthdays */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Team Information */}
            <EmployeeTeamInfo />

            {/* Upcoming Birthdays */}
            <UpcomingBirthdays />
          </div>
        </div>
      </div>
    </DashboardLayout>
    </>
  );
}
