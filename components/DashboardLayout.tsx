'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  IconLayoutDashboard,
  IconUsers,
  IconCalendar,
  IconCurrencyDollar,
  IconClock,
  IconFileText,
  IconLogout,
  IconMenu2,
  IconX,
  IconUser,
  IconUserCog,
  IconUserCircle,
  IconMessage,
  IconCalendarEvent,
  IconGift,
} from '@tabler/icons-react';
import Logo from './Logo';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';
import { User } from 'lucide-react';
import LogoWhite from './LogoWhite';

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: 'admin' | 'hr' | 'employee';
}

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Fetch profileImage if not in session
  useEffect(() => {
    const fetchProfileImage = async () => {
      // First check if profileImage is in session
      const sessionImage = (session?.user as any)?.image || (session?.user as any)?.profileImage;
      if (sessionImage) {
        setProfileImage(sessionImage);
        return;
      }

      // If not in session, fetch it from API
      try {
        const res = await fetch('/api/profile/image');
        const data = await res.json();
        if (res.ok && data.profileImage) {
          setProfileImage(data.profileImage);
        }
      } catch (err) {
        console.error('Error fetching profile image:', err);
      }
    };

    if (session && status === 'authenticated') {
      fetchProfileImage();
    }
  }, [session, status]);

  // Verify that the user's role matches the expected role
  useEffect(() => {
    if (status === 'loading') return; // Still loading session

    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    if (session) {
      const userRole = (session.user as any)?.role;

      // If role doesn't match, redirect to the correct dashboard
      if (userRole !== role) {
        if (userRole === 'admin') {
          router.push('/admin');
        } else if (userRole === 'hr') {
          router.push('/hr');
        } else if (userRole === 'employee') {
          router.push('/employee');
        } else {
          router.push('/');
        }
      }
    }
  }, [session, status, role, router]);

  const adminMenu = [
    { name: 'Dashboard', href: '/admin', icon: IconLayoutDashboard },
    { name: 'Feed', href: '/admin/feed', icon: IconMessage },
    { name: 'Employees', href: '/admin/employees', icon: IconUser },
    { name: 'Team Management', href: '/admin/teams', icon: IconUsers },
    { name: 'Leave Management', href: '/admin/leaves', icon: IconCalendar },
    { name: 'Attendance', href: '/admin/attendance', icon: IconClock },
    { name: 'Finance', href: '/admin/finance', icon: IconCurrencyDollar },
    { name: 'Profile', href: '/admin/profile', icon: IconUserCircle },
  ];

  const hrMenu = [
    { name: 'Dashboard', href: '/hr', icon: IconLayoutDashboard },
    { name: 'Feed', href: '/hr/feed', icon: IconMessage },
    { name: 'Employees', href: '/hr/employees', icon: IconUser },
    { name: 'Team Management', href: '/hr/teams', icon: IconUsers },
    { name: 'Leave Management', href: '/hr/leaves', icon: IconCalendar },
    { name: 'Attendance', href: '/hr/attendance', icon: IconClock },
    { name: 'Finance Reports', href: '/hr/finance', icon: IconCurrencyDollar },
    { name: 'Wishing', href: '/hr/wishing', icon: IconGift },
    { name: 'Profile', href: '/hr/profile', icon: IconUserCircle },
  ];

  const employeeMenu = [
    { name: 'Dashboard', href: '/employee', icon: IconLayoutDashboard },
    { name: 'Feed', href: '/employee/feed', icon: IconMessage },
    { name: 'Attendance', href: '/employee/attendance', icon: IconClock },
    { name: 'Leave Management', href: '/employee/leaves', icon: IconCalendar },
    { name: 'Salary Slips', href: '/employee/finance', icon: IconCurrencyDollar },
    { name: 'Profile', href: '/employee/profile', icon: IconUserCircle },
  ];

  const menu = role === 'admin' ? adminMenu : role === 'hr' ? hrMenu : employeeMenu;

  const handleLogout = async () => {
    try {
      // Sign out without redirect first
      await signOut({ redirect: false });
      // Then manually redirect using current origin to ensure it works on mobile
      window.location.href = window.location.origin + '/';
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: if signOut fails, force redirect using current origin
      window.location.href = window.location.origin + '/';
    }
  };

  // Get user initials for avatar fallback
  const getUserInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  };

  // Use profileImage from state (fetched from API if not in session) or fallback to session
  const userImage = profileImage || (session?.user as any)?.image || (session?.user as any)?.profileImage;
  const userName = session?.user?.name;
  const userRole = (session?.user as any)?.role;

  // Show loading state while session is loading or role doesn't match
  if (status === 'loading' || (session && userRole !== role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingDots size="lg" />
          <p className="mt-4 text-gray-600 font-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render (redirect will happen in useEffect)
  if (status === 'unauthenticated' || !session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-56 bg-primary shadow-lg z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4">
            <div className="mb-1">
              <LogoWhite size="sm" />
            </div>
            <p className="text-xs text-gray-100 capitalize font-secondary mt-1">{role} Portal</p>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {menu
              .filter((item) => item.name !== 'Profile') // Exclude Profile from main menu
              .map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <motion.a
                    key={item.name}
                    href={item.href}
                    whileHover={{ x: 2 }}
                    className={`flex items-center gap-2.5 px-3 py-2 transition-colors text-sm rounded-xl ${isActive
                      ? 'bg-[#00009f] text-white font-medium'
                      : 'text-gray-400 hover:bg-[#00009f]'
                      }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-secondary">{item.name}</span>
                  </motion.a>
                );
              })}

            {/* Separator with Personalize section */}
            <div className="pt-3 mt-3">
              <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider font-secondary mb-1">
                Personalize
              </p>
              {menu
                .filter((item) => item.name === 'Profile')
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <motion.a
                      key={item.name}
                      href={item.href}
                      whileHover={{ x: 2 }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${isActive
                        ? 'bg-[#00009f] text-white font-medium'
                        : 'text-gray-400 hover:bg-[#00009f]'
                        }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-secondary">{item.name}</span>
                    </motion.a>
                  );
                })}
              {/* Add Leave Request and Attendance for HR */}
              {role === 'hr' && (
                <>
                  <motion.a
                    href="/hr/leave-request"
                    whileHover={{ x: 2 }}
                    className={`flex items-center mt-1 gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${pathname === '/hr/leave-request'
                      ? 'bg-[#00009f] text-white font-medium'
                      : 'text-gray-400 hover:bg-[#00009f]'
                      }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <IconCalendarEvent className="w-4 h-4" />
                    <span className="font-secondary">Leave Request</span>
                  </motion.a>
                  <motion.a
                    href="/hr/my-attendance"
                    whileHover={{ x: 2 }}
                    className={`flex items-center mt-1 gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${pathname === '/hr/my-attendance'
                      ? 'bg-[#00009f] text-white font-medium'
                      : 'text-gray-400 hover:bg-[#00009f]'
                      }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <IconClock className="w-4 h-4" />
                    <span className="font-secondary">Attendance</span>
                  </motion.a>
                  <motion.a
                    href="/hr/salary"
                    whileHover={{ x: 2 }}
                    className={`flex items-center mt-1 gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${pathname === '/hr/salary'
                      ? 'bg-[#00009f] text-white font-medium'
                      : 'text-gray-400 hover:bg-[#00009f]'
                      }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <IconCurrencyDollar className="w-4 h-4" />
                    <span className="font-secondary">Salary Slip</span>
                  </motion.a>
                </>
              )}
            </div>
          </nav>

          <div className="p-3">
            <div className="px-3 py-2 mb-2 flex items-center gap-2 bg-[#000077] rounded-lg">
              <UserAvatar
                name={userName}
                image={userImage}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-100 font-primary truncate">{userName}</p>
                <p className="text-xs text-gray-500 font-secondary truncate">{session?.user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-600 hover:bg-red-700 hover:text-white transition-colors text-sm "
            >
              <IconLogout className="w-4 h-4" />
              <span className="font-secondary">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-56">

        {/* Mobile Bottom Navigation Bar - Glass Effect */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
          <div className="bg-primary/80 border border-t border-primary backdrop-blur-lg shadow-xl py-3 pb-6 px-2">
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-1 px-2 py-1.5 min-w-max justify-center">
                {menu
                  .filter((item) => item.name !== 'Profile') // Exclude Profile from menu items
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <motion.a
                        key={item.name}
                        href={item.href}
                        whileTap={{ scale: 0.95 }}
                        className={`flex items-center justify-center px-4 py-3 rounded-xl transition-all ${isActive
                          ? 'bg-primary/40 text-white'
                          : 'text-gray-400 hover:bg-primary/10'
                          }`}
                      >
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                      </motion.a>
                    );
                  })}

                {/* User Profile Picture */}
                <motion.a
                  href={`/${role}/profile`}
                  whileTap={{ scale: 0.95 }}
                  className={`flex items-center justify-center px-3 py-2 rounded-xl transition-all ${pathname === `/${role}/profile`
                    ? 'bg-primary/10'
                    : ''
                    }`}
                >
                  <UserAvatar
                    name={userName}
                    image={userImage}
                    size="sm"
                  />
                </motion.a>

                {/* Logout Button */}
                <motion.button
                  onClick={handleLogout}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center px-4 py-3 rounded-xl transition-all text-red-600 hover:bg-red-50/50"
                >
                  <IconLogout className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="bg-[#eef3ff] p-3 pb-16 lg:pb-4">{children}</main>
      </div>
    </div>
  );
}

