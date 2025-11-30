'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  Clock,
  FileText,
  LogOut,
  Menu,
  X,
  User,
  UserCog,
  UserCircle,
  MessageSquare,
} from 'lucide-react';
import Logo from './Logo';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';
import LeaveNotificationAlert from './LeaveNotificationAlert';

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
      router.push('/login');
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
          router.push('/login');
        }
      }
    }
  }, [session, status, role, router]);

  const adminMenu = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Feed', href: '/admin/feed', icon: MessageSquare },
    { name: 'Employees', href: '/admin/employees', icon: Users },
    { name: 'Team Management', href: '/admin/teams', icon: UserCog },
    { name: 'Leave Management', href: '/admin/leaves', icon: Calendar },
    { name: 'Attendance', href: '/admin/attendance', icon: Clock },
    { name: 'Finance', href: '/admin/finance', icon: DollarSign },
    { name: 'Profile', href: '/admin/profile', icon: UserCircle },
  ];

  const hrMenu = [
    { name: 'Dashboard', href: '/hr', icon: LayoutDashboard },
    { name: 'Feed', href: '/hr/feed', icon: MessageSquare },
    { name: 'Employees', href: '/hr/employees', icon: Users },
    { name: 'Team Management', href: '/hr/teams', icon: UserCog },
    { name: 'Leave Management', href: '/hr/leaves', icon: Calendar },
    { name: 'Attendance', href: '/hr/attendance', icon: Clock },
    { name: 'Finance Reports', href: '/hr/finance', icon: DollarSign },
    { name: 'Profile', href: '/hr/profile', icon: UserCircle },
  ];

  const employeeMenu = [
    { name: 'Dashboard', href: '/employee', icon: LayoutDashboard },
    { name: 'Feed', href: '/employee/feed', icon: MessageSquare },
    { name: 'Attendance', href: '/employee/attendance', icon: Clock },
    { name: 'Leave Management', href: '/employee/leaves', icon: Calendar },
    { name: 'Salary Slips', href: '/employee/finance', icon: DollarSign },
    { name: 'Profile', href: '/employee/profile', icon: UserCircle },
  ];

  const menu = role === 'admin' ? adminMenu : role === 'hr' ? hrMenu : employeeMenu;

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
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
    <>
      {role === 'employee' && <LeaveNotificationAlert />}
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
        className={`fixed top-0 left-0 h-full w-56 bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b">
            <div className="mb-1">
              <Logo size="sm" />
            </div>
            <p className="text-xs text-gray-500 capitalize font-secondary mt-1">{role} Portal</p>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {menu.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <motion.a
                  key={item.name}
                  href={item.href}
                  whileHover={{ x: 2 }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${
                    isActive
                      ? 'bg-primary-100 text-primary font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-secondary">{item.name}</span>
                </motion.a>
              );
            })}
          </nav>

          <div className="p-3 border-t">
            <div className="px-3 py-2 mb-2 flex items-center gap-2">
              <UserAvatar
                name={userName}
                image={userImage}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 font-primary truncate">{userName}</p>
                <p className="text-xs text-gray-500 font-secondary truncate">{session?.user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="font-secondary">Logout</span>
            </button>
          </div>
        </div>
        </aside>

        {/* Main content */}
        <div className="lg:pl-56">

        {/* Mobile Bottom Navigation Bar - Glass Effect */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
          <div className="bg-white/10 border border-t border-white backdrop-blur-lg shadow-xl py-1 px-2">
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-1 px-2 py-1.5 min-w-max">
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
                        className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[70px] ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-600 hover:bg-gray-100/50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-gray-600'}`} />
                        <span className="text-[10px] font-secondary font-medium leading-tight text-center">
                          {item.name}
                        </span>
                      </motion.a>
                    );
                  })}
                
                {/* User Profile Picture */}
                <motion.a
                  href={`/${role}/profile`}
                  whileTap={{ scale: 0.95 }}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-[50px] ${
                    pathname === `/${role}/profile`
                      ? 'bg-primary/10'
                      : ''
                  }`}
                >
                  <UserAvatar
                    name={userName}
                    image={userImage}
                    size="sm"
                  />
                  <span className={`text-[9px] font-secondary font-medium leading-tight text-center ${
                    pathname === `/${role}/profile`
                      ? 'text-primary'
                      : 'text-gray-600'
                  }`}>
                    Profile
                  </span>
                </motion.a>

                {/* Logout Button */}
                <motion.button
                  onClick={handleLogout}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[60px] text-red-600 hover:bg-red-50/50"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-[10px] font-secondary font-medium leading-tight text-center">
                    Logout
                  </span>
                </motion.button>
              </div>
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="bg-[#eef3ff] p-3 pb-16 lg:pb-4">{children}</main>
      </div>
      </div>
    </>
  );
}

