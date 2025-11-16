'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import EmployeeTeamInfo from '@/components/EmployeeTeamInfo';
import EmployeeSearch from '@/components/EmployeeSearch';
import TimeTrackingWidget from '@/components/TimeTrackingWidget';
import UpcomingBirthdays from '@/components/UpcomingBirthdays';
import { Clock, Calendar, Users, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/contexts/ToastContext';
import UserAvatar from '@/components/UserAvatar';
import LoadingDots from '@/components/LoadingDots';

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

  useEffect(() => {
    if (session) {
      fetchStats();
    }
  }, [session, fetchStats]);

  return (
    <DashboardLayout role="employee">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="space-y-6 p-4 md:p-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <UserAvatar
                  name={session?.user?.name || ''}
                  image={(session?.user as any)?.profileImage}
                  size="lg"
                />
                <h3 className="text-2xl font-primary font-bold text-gray-800">Welcome {session?.user?.name}</h3>
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
  );
}
