'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Mail, Phone, Crown, Calendar } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';

interface TeamMember {
  _id: string;
  name: string;
  email: string;
  profileImage?: string;
  mobileNumber?: string;
}

interface Team {
  _id: string;
  name: string;
  description?: string;
  leader: TeamMember;
  members: TeamMember[];
}

export default function EmployeeTeamInfo() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeesOnLeaveToday, setEmployeesOnLeaveToday] = useState<string[]>([]);
  const toast = useToast();

  const fetchMyTeams = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/teams/my-team');
      const data = await res.json();

      if (res.ok) {
        setTeams(data.teams || []);
      } else {
        toast.error(data.error || 'Failed to fetch team information');
      }
    } catch (err: any) {
      toast.error('An error occurred while fetching team information');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMyTeams();
  }, [fetchMyTeams]);

  // Fetch employees on leave today
  const fetchEmployeesOnLeave = useCallback(async () => {
    try {
      // Add cache-busting to ensure fresh data
      const res = await fetch('/api/leave/on-leave-today', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json();
      if (res.ok && data.userIdsOnLeave) {
        setEmployeesOnLeaveToday(data.userIdsOnLeave);
      }
    } catch (err) {
      console.error('Error fetching employees on leave:', err);
    }
  }, []);

  useEffect(() => {
    // Fetch immediately
    fetchEmployeesOnLeave();

    // Refresh every 5 seconds to catch status changes quickly
    const interval = setInterval(fetchEmployeesOnLeave, 5000);

    // Refresh when window comes into focus
    const handleFocus = () => {
      fetchEmployeesOnLeave();
    };
    window.addEventListener('focus', handleFocus);

    // Listen for custom event to refresh immediately when leave status changes
    const handleLeaveStatusChange = () => {
      // Clear state first, then fetch fresh data
      setEmployeesOnLeaveToday([]);
      // Small delay to ensure database is updated
      setTimeout(() => {
        fetchEmployeesOnLeave();
      }, 200);
    };
    window.addEventListener('leaveStatusChanged', handleLeaveStatusChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('leaveStatusChanged', handleLeaveStatusChange);
    };
  }, [fetchEmployeesOnLeave]);

  if (loading) {
    return (
      <div className="w-full h-[400px] bg-white rounded-md shadow-xl border border-gray-100 flex flex-col overflow-hidden">
        <div className="flex flex-col items-center justify-center flex-1">
          <LoadingDots size="lg" className="mb-3" />
          <p className="text-sm text-gray-500 font-secondary">Loading team information...</p>
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="w-full h-[400px] bg-white rounded-md shadow-xl border border-gray-100 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between flex-shrink-0 p-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 rounded-md">
              <Users className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-sm font-primary font-bold text-gray-900">My Team</h2>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-gray-50/50">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 font-secondary font-medium">You are not assigned to any team yet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px] flex flex-col">
      {teams.map((team) => {
        // Combine leader and members, ensuring leader is first
        const allMembers = [
          team.leader,
          ...team.members.filter((m) => m._id !== team.leader._id),
        ];

        return (
          <motion.div
            key={team._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full h-full bg-white rounded-md shadow-xl border border-gray-100 flex flex-col overflow-hidden"
          >
            {/* Team Header */}
            <div className="flex items-center justify-between flex-shrink-0 p-3 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 rounded-md">
                  <Users className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-primary font-bold text-gray-900 truncate">{team.name}</h2>
                  {team.description && (
                    <p className="text-[9px] text-gray-500 font-secondary mt-0.5 truncate">{team.description}</p>
                  )}
                </div>
              </div>
              <div className="px-2.5 py-1 bg-purple-100 rounded-full flex items-center gap-1 flex-shrink-0">
                <Users className="w-3 h-3 text-purple-600" />
                <span className="text-xs font-bold text-purple-700 font-primary">
                  {allMembers.length}
                </span>
              </div>
            </div>

            {/* Team Members List - Scrollable */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <div className="space-y-1.5">
              {allMembers.map((member, index) => {
                const isLeader = member._id === team.leader._id;
                const isOnLeave = employeesOnLeaveToday.includes(member._id);
                return (
                  <motion.div
                    key={member._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`group rounded-md transition-all duration-200 p-4 relative ${
                      isLeader
                        ? 'bg-orange-50 hover:bg-orange-100'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    {/* Leader Badge */}
                    {isLeader && (
                      <div className="absolute top-2 right-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 z-10">
                        <Crown className="w-3 h-3" />
                        <span className="text-[10px] font-bold font-secondary">Leader</span>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <UserAvatar
                          name={member.name}
                          image={member.profileImage}
                          size="sm"
                        />
                        {isOnLeave && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center">
                            <Calendar className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-xs font-semibold text-gray-900 font-primary truncate">
                            {member.name}
                          </h3>
                          {isOnLeave && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-orange-100 text-orange-700 flex items-center gap-1 font-secondary flex-shrink-0">
                              <Calendar className="w-2 h-2" />
                              On Leave
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-[10px] text-gray-600 font-secondary">
                            <Mail className="w-3 h-3 text-blue-600 flex-shrink-0" />
                            <span className="truncate">{member.email}</span>
                          </div>
                          {member.mobileNumber && (
                            <div className="flex items-center gap-2 text-[10px] text-gray-600 font-secondary">
                              <Phone className="w-3 h-3 text-green-600 flex-shrink-0" />
                              <span className="truncate">{member.mobileNumber}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
