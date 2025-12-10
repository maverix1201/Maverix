'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import EmployeeTeamInfo from '@/components/EmployeeTeamInfo';
import EmployeeSearch from '@/components/EmployeeSearch';
import TimeTrackingWidget from '@/components/TimeTrackingWidget';
import UpcomingBirthdays from '@/components/UpcomingBirthdays';
import EmployeeProfileCard from '@/components/EmployeeProfileCard';
import BirthdayCelebration from '@/components/BirthdayCelebration';
import AnnouncementModal from '@/components/AnnouncementModal';
import NotificationDropdown from '@/components/NotificationDropdown';
import { Clock, Calendar, Users, TrendingUp, Megaphone, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/contexts/ToastContext';
import UserAvatar from '@/components/UserAvatar';
import LoadingDots from '@/components/LoadingDots';
import Logo from '@/components/Logo';

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
  const [activeAnnouncements, setActiveAnnouncements] = useState<any[]>([]);
  const [showAnnouncementButton, setShowAnnouncementButton] = useState(true); // Always visible
  const [hasNewAnnouncement, setHasNewAnnouncement] = useState(false);
  const [lastAnnouncementId, setLastAnnouncementId] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('🌟 Welcome');
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

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
      const timestamp = Date.now();
      const [leavesRes, leaveTypesRes, teamsRes, weeklyHoursRes, attendanceRes] = await Promise.all([
        fetch(`/api/leave?t=${timestamp}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`/api/leave/allotted-types?t=${timestamp}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`/api/teams/my-team?t=${timestamp}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`/api/attendance/weekly-hours?t=${timestamp}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`/api/attendance/stats?t=${timestamp}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }),
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
      const res = await fetch(`/api/profile?t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
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
      const res = await fetch(`/api/profile/image?t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
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
      const res = await fetch(`/api/announcements?t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
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

  const fetchActiveAnnouncements = useCallback(async (isInitialLoad = false) => {
    try {
      // Use a query parameter to get all announcements including future ones
      const res = await fetch(`/api/announcements?all=true&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      const data = await res.json();
      
      if (res.ok && data.announcements) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Filter announcements that are today or in the future
        const active = data.announcements.filter((announcement: any) => {
          const announcementDate = new Date(announcement.date);
          announcementDate.setHours(0, 0, 0, 0);
          return announcementDate >= today;
        });
        
        // Sort by creation date (newest first)
        active.sort((a: any, b: any) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        // Check for new announcement
        if (!isInitialLoad && active.length > 0 && lastAnnouncementId) {
          const newestAnnouncement = active[0];
          if (newestAnnouncement._id !== lastAnnouncementId) {
            // New announcement detected!
            setHasNewAnnouncement(true);
            // Stop glowing after 10 seconds
            setTimeout(() => {
              setHasNewAnnouncement(false);
            }, 10000);
          }
        }
        
        // Update last announcement ID
        if (active.length > 0) {
          setLastAnnouncementId(active[0]._id);
        }
        
        setActiveAnnouncements(active);
        setShowAnnouncementButton(true); // Always show button
      }
    } catch (err) {
      console.error('Error fetching active announcements:', err);
    }
  }, [lastAnnouncementId]);

  const handleShowAnnouncement = async () => {
    // Stop the glowing animation when button is clicked
    setHasNewAnnouncement(false);
    
    // If no active announcements, fetch them first
    if (activeAnnouncements.length === 0) {
      // Fetch announcements and get the result
      const res = await fetch(`/api/announcements?all=true&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      const data = await res.json();
      
      if (res.ok && data.announcements) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const active = data.announcements.filter((announcement: any) => {
          const announcementDate = new Date(announcement.date);
          announcementDate.setHours(0, 0, 0, 0);
          return announcementDate >= today;
        });
        
        active.sort((a: any, b: any) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        if (active.length > 0) {
          setAnnouncements(active);
          setCurrentAnnouncementIndex(0);
          setShowAnnouncement(true);
        }
      }
    } else {
      setAnnouncements(activeAnnouncements);
      setCurrentAnnouncementIndex(0);
      setShowAnnouncement(true);
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
      // Refresh active announcements to update button visibility
      fetchActiveAnnouncements();
    }
  };

  const handleAnnouncementViewTracked = () => {
    // Refresh announcements to get updated view counts
    fetchAnnouncements();
    fetchActiveAnnouncements(); // Also refresh active announcements
  };

  useEffect(() => {
    if (session) {
      fetchStats();
      fetchUserProfile();
      fetchAnnouncements();
      fetchActiveAnnouncements(true); // Initial load
      fetchProfileImage();
    }

    // Refetch when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session) {
        fetchStats();
        fetchActiveAnnouncements(false);
        fetchUnreadNotificationCount();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Refetch when window gains focus
    const handleFocus = () => {
      if (session) {
        fetchStats();
        fetchActiveAnnouncements(false);
        fetchUnreadNotificationCount();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session, fetchStats, fetchProfileImage, fetchActiveAnnouncements]);

  // Check for new announcements periodically (every 5 seconds)
  useEffect(() => {
    if (!session) return;
    
    const interval = setInterval(() => {
      fetchActiveAnnouncements(false); // Check for updates
      fetchUnreadNotificationCount(); // Check for new notifications
    }, 5000); // Check every 5 seconds for new announcements

    return () => clearInterval(interval);
  }, [session, lastAnnouncementId, fetchActiveAnnouncements]);

  // Fetch unread notification count
  const fetchUnreadNotificationCount = async () => {
    try {
      const res = await fetch(`/api/notifications?limit=10&includeDismissed=false&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      const data = await res.json();
      if (res.ok) {
        const unread = data.notifications?.filter((n: any) => !n.read).length || 0;
        setUnreadNotificationCount(unread);
      }
    } catch (err) {
      console.error('Error fetching notification count:', err);
    }
  };

  // Initial fetch of notification count
  useEffect(() => {
    if (session) {
      fetchUnreadNotificationCount();
    }
  }, [session]);

  return (
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
          {/* Logo and Action Buttons - Mobile Only */}
          <div className="flex items-center justify-between md:hidden mb-4">
            <Logo size="md" />
            <div className="flex items-center gap-2">
              {showAnnouncementButton && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: 1,
                    scale: hasNewAnnouncement ? [1, 1.1, 1] : 1,
                    boxShadow: hasNewAnnouncement
                      ? [
                          '0 0 0 0 rgba(59, 130, 246, 0.7)',
                          '0 0 0 10px rgba(59, 130, 246, 0)',
                          '0 0 0 0 rgba(59, 130, 246, 0)',
                        ]
                      : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  }}
                  transition={{
                    scale: {
                      duration: 0.6,
                      repeat: hasNewAnnouncement ? Infinity : 0,
                      repeatDelay: 1,
                    },
                    boxShadow: {
                      duration: 1.5,
                      repeat: hasNewAnnouncement ? Infinity : 0,
                      repeatDelay: 0.5,
                    },
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setHasNewAnnouncement(false);
                    handleShowAnnouncement();
                  }}
                  className={`relative flex items-center justify-center w-10 h-10 bg-white text-black rounded-lg shadow-md hover:shadow-lg transition-all z-10 ${
                    hasNewAnnouncement ? 'ring-2 ring-blue-400 ring-opacity-75' : ''
                  }`}
                >
                  <Megaphone className={`w-4 h-4 relative z-10 ${hasNewAnnouncement ? 'animate-pulse' : ''}`} />
                  {activeAnnouncements.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center z-10">
                      {activeAnnouncements.length}
                    </span>
                  )}
                </motion.button>
              )}
              
              {/* Notification Button */}
              <div className="relative">
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowNotificationDropdown(!showNotificationDropdown);
                    fetchUnreadNotificationCount();
                  }}
                  className="relative flex items-center justify-center w-10 h-10 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-all z-10"
                >
                  <Bell className="w-5 h-5 text-gray-700" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                    </span>
                  )}
                </motion.button>
                
                {/* Notification Dropdown */}
                <AnimatePresence>
                  {showNotificationDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 z-50"
                    >
                      <NotificationDropdown
                        onClose={() => setShowNotificationDropdown(false)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
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
                  <h3 className="text-md font-bold text-gray-800">{greeting}, <span className="text-secondary">{session?.user?.name?.split(' ')[0] || session?.user?.name}</span></h3>
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
            <div className="w-full md:w-auto flex items-center gap-3 flex-wrap">
              <EmployeeSearch />
              {showAnnouncementButton && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: 1,
                    scale: hasNewAnnouncement ? [1, 1.1, 1] : 1,
                    boxShadow: hasNewAnnouncement
                      ? [
                          '0 0 0 0 rgba(59, 130, 246, 0.7)',
                          '0 0 0 10px rgba(59, 130, 246, 0)',
                          '0 0 0 0 rgba(59, 130, 246, 0)',
                        ]
                      : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  }}
                  transition={{
                    scale: {
                      duration: 0.6,
                      repeat: hasNewAnnouncement ? Infinity : 0,
                      repeatDelay: 1,
                    },
                    boxShadow: {
                      duration: 1.5,
                      repeat: hasNewAnnouncement ? Infinity : 0,
                      repeatDelay: 0.5,
                    },
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setHasNewAnnouncement(false); // Stop animation when clicked
                    handleShowAnnouncement();
                  }}
                  className={`hidden md:flex relative items-center gap-2 px-4 py-3 bg-white text-black rounded-lg shadow-md hover:shadow-lg transition-all font-secondary font-semibold text-sm whitespace-nowrap z-10 ${
                    hasNewAnnouncement ? 'ring-2 ring-blue-400 ring-opacity-75' : ''
                  }`}
                >
                  <Megaphone className={`w-4 h-4 relative z-10 ${hasNewAnnouncement ? 'animate-pulse' : ''}`} />
                  {activeAnnouncements.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {activeAnnouncements.length}
                    </span>
                  )}
                </motion.button>
              )}
              
              {/* Notification Button */}
              <div className="relative hidden md:block">
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowNotificationDropdown(!showNotificationDropdown);
                    fetchUnreadNotificationCount(); // Refresh count when opening
                  }}
                  className="relative flex items-center justify-center w-10 h-10 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-all z-10"
                >
                  <Bell className="w-5 h-5 text-gray-700" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                    </span>
                  )}
                </motion.button>
                
                {/* Notification Dropdown */}
                <AnimatePresence>
                  {showNotificationDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 z-50"
                    >
                      <NotificationDropdown
                        onClose={() => setShowNotificationDropdown(false)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Time Tracking Widget and Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <TimeTrackingWidget />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-yellow-100 rounded-xl shadow-md p-6 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-yellow-500 p-3 rounded-full shadow-sm">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-700 font-secondary mb-2 font-semibold">Total Leave Types</p>
                {loading ? (
                  <div className="h-10 flex items-center">
                    <LoadingDots size="md" />
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-primary font-bold text-gray-900 mb-2">{stats.totalLeaveTypes}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold font-secondary text-green-600">
                        ↑ {stats.totalLeaveTypes > 0 ? 100 : 0}%
                      </span>
                      <span className="text-xs text-gray-600 font-secondary">Available</span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-teal-100 rounded-xl shadow-md p-6 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-teal-500 p-3 rounded-full shadow-sm">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-700 font-secondary mb-2 font-semibold">Pending Leaves</p>
                {loading ? (
                  <div className="h-10 flex items-center">
                    <LoadingDots size="md" />
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-primary font-bold text-gray-900 mb-2">{stats.pendingLeaves}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold font-secondary text-red-600">
                        ↓ {stats.pendingLeaves > 0 ? 50 : 0}%
                      </span>
                      <span className="text-xs text-gray-600 font-secondary">Pending</span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-pink-100 rounded-xl shadow-md p-6 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-pink-500 p-3 rounded-full shadow-sm">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-700 font-secondary mb-2 font-semibold">Total in Team</p>
                {loading ? (
                  <div className="h-10 flex items-center">
                    <LoadingDots size="md" />
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-primary font-bold text-gray-900 mb-2">{stats.totalInTeam}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold font-secondary text-green-600">
                        ↑ {stats.totalInTeam > 0 ? 75 : 0}%
                      </span>
                      <span className="text-xs text-gray-600 font-secondary">Active</span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-blue-100 rounded-xl shadow-md p-6 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-blue-500 p-3 rounded-full shadow-sm">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-700 font-secondary mb-2 font-semibold">Working Hours (Week)</p>
                {loading ? (
                  <div className="h-10 flex items-center">
                    <LoadingDots size="md" />
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-primary font-bold text-gray-900 mb-2">{stats.weeklyHours}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold font-secondary text-green-600">
                        ↑ {stats.weeklyHours > 0 ? 60 : 0}%
                      </span>
                      <span className="text-xs text-gray-600 font-secondary">This Week</span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>

          {/* Right Side Section - Team Info, Upcoming Birthdays, and Profile Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            {/* Team Information */}
            <div className="lg:col-span-1 flex flex-col h-full">
              <div className="flex-1">
                <EmployeeTeamInfo />
              </div>
            </div>

            {/* Upcoming Birthdays */}
            <div className="lg:col-span-1 flex flex-col h-full">
              <div className="flex-1">
                <UpcomingBirthdays />
              </div>
            </div>

            {/* Employee Profile Card */}
            <div className="lg:col-span-1 flex flex-col h-full">
              <div className="flex-1">
                <EmployeeProfileCard />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
