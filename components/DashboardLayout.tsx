'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  IconLayoutDashboard,
  IconUsers,
  IconCalendar,
  IconCurrencyDollar,
  IconClock,
  IconLogout,
  IconUser,
  IconUserCircle,
  IconMessage,
  IconCalendarEvent,
  IconFileText,
} from '@tabler/icons-react';
import Logo from './Logo';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';
import LogoWhite from './LogoWhite';

// Loaded on-demand to keep the dashboard layout lean
const ProfileCompletionBanner = dynamic(() => import('./ProfileCompletionBanner'), {
  ssr: false,
  loading: () => null,
});

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: 'admin' | 'hr' | 'employee';
}

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

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
    if (!mounted || !router) return; // Wait for client-side mount and ensure router is available

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
  }, [mounted, session, status, role, router]);

  const adminMenu = [
    { name: 'Dashboard', href: '/admin', icon: IconLayoutDashboard },
    { name: 'Feed', href: '/admin/feed', icon: IconMessage },
    { name: 'Employees', href: '/admin/employees', icon: IconUser },
    { name: 'Team Management', href: '/admin/teams', icon: IconUsers },
    { name: 'Leave Management', href: '/admin/leaves', icon: IconCalendar },
    { name: 'Attendance', href: '/admin/attendance', icon: IconClock },
    { name: 'Finance', href: '/admin/finance', icon: IconCurrencyDollar },
    { name: 'Resignation', href: '/admin/resignation', icon: IconFileText },
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
    { name: 'Resignation', href: '/hr/resignation', icon: IconFileText },
    { name: 'Profile', href: '/hr/profile', icon: IconUserCircle },
  ];

  const employeeMenu = [
    { name: 'Dashboard', href: '/employee', icon: IconLayoutDashboard },
    { name: 'Feed', href: '/employee/feed', icon: IconMessage },
    { name: 'Attendance', href: '/employee/attendance', icon: IconClock },
    { name: 'Leave Management', href: '/employee/leaves', icon: IconCalendar },
    { name: 'Salary Slips', href: '/employee/finance', icon: IconCurrencyDollar },
    { name: 'Resignation', href: '/employee/resignation', icon: IconFileText },
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
                const isActive = mounted && pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 transition-colors text-sm rounded-xl ${isActive
                      ? 'bg-[#00009f] text-white font-medium'
                      : 'text-gray-400 hover:bg-[#00009f] hover:text-gray-100'
                      }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-secondary">{item.name}</span>
                  </Link>
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
                  const isActive = mounted && pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${isActive
                        ? 'bg-[#00009f] text-white font-medium'
                        : 'text-gray-400 hover:bg-[#00009f] hover:text-gray-100'
                        }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-secondary">{item.name}</span>
                    </Link>
                  );
                })}
              {/* Add Leave Request and Attendance for HR */}
              {role === 'hr' && (
                <>
                  <Link
                    href="/hr/leave-request"
                    className={`flex items-center mt-1 gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${mounted && pathname === '/hr/leave-request'
                      ? 'bg-[#00009f] text-white font-medium'
                      : 'text-gray-400 hover:bg-[#00009f] hover:text-gray-100'
                      }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <IconCalendarEvent className="w-4 h-4" />
                    <span className="font-secondary">Leave Request</span>
                  </Link>
                  <Link
                    href="/hr/my-attendance"
                    className={`flex items-center mt-1 gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${mounted && pathname === '/hr/my-attendance'
                      ? 'bg-[#00009f] text-white font-medium'
                      : 'text-gray-400 hover:bg-[#00009f] hover:text-gray-100'
                      }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <IconClock className="w-4 h-4" />
                    <span className="font-secondary">Attendance</span>
                  </Link>
                  <Link
                    href="/hr/salary"
                    className={`flex items-center mt-1 gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${mounted && pathname === '/hr/salary'
                      ? 'bg-[#00009f] text-white font-medium'
                      : 'text-gray-400 hover:bg-[#00009f] hover:text-gray-100'
                      }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <IconCurrencyDollar className="w-4 h-4" />
                    <span className="font-secondary">Salary Slip</span>
                  </Link>
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

        {/* Mobile Bottom Navigation Bar - Glassmorphism */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
          <div className="mx-0 mb-0 bg-[#dedeff]/40 backdrop-blur-md border border-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] pb-[env(safe-area-inset-bottom,0px)]">
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-1 px-2 py-1 min-w-max justify-center">
                {menu
                  .filter((item) => item.name !== 'Profile')
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = mounted && pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="flex items-center justify-center p-1 relative"
                      >
                        <div className={`flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-300 ${isActive
                            ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105'
                            : 'text-gray-500 hover:bg-white/80 hover:text-gray-700 hover:shadow-md'
                          }`}>
                          <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
                        </div>
                      </Link>
                    );
                  })}

                {/* User Profile */}
                <Link
                  href={`/${role}/profile`}
                  className="flex items-center justify-center p-2.5"
                >
                  <div className={`flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-300 ${mounted && pathname === `/${role}/profile`
                      ? 'ring-2 ring-primary ring-offset-2 shadow-lg scale-105'
                      : 'hover:shadow-md'
                    }`}>
                    <UserAvatar
                      name={userName}
                      image={userImage}
                      size="sm"
                    />
                  </div>
                </Link>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center p-2.5"
                >
                  <div className="flex items-center justify-center w-11 h-11 rounded-2xl text-red-500 hover:bg-red-50/80 hover:shadow-md transition-all duration-300">
                    <IconLogout className="w-5 h-5" strokeWidth={1.8} />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Profile Completion Banner */}
        <ProfileCompletionBanner />

        {/* Page content */}
        <main className="bg-[#eef3ff] p-3 pb-16 lg:pb-4">{children}</main>
      </div>
    </div>
  );
}

