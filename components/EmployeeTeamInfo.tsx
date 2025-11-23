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
      <div className="w-full max-w-[400px] h-[400px] bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20 flex flex-col">
        <div className="flex flex-col items-center justify-center flex-1">
          <LoadingDots size="lg" className="mb-3" />
          <p className="text-sm text-gray-500 font-secondary">Loading team information...</p>
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="w-full max-w-[400px] h-[400px] bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20 flex flex-col">
        <h2 className="text-lg font-primary font-bold text-gray-800 mb-3 flex-shrink-0">My Team</h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-xs text-gray-600 font-secondary">You are not assigned to any team yet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px] h-[400px] flex flex-col">
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
            className="w-full h-full bg-gradient-to-br from-white via-white to-gray-50/50 rounded-xl shadow-lg p-4 border border-gray-200/50 backdrop-blur-sm flex flex-col"
          >
            {/* Team Header */}
            <div className="mb-4 flex-shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-primary font-bold text-gray-800 truncate">{team.name}</h2>
                  {team.description && (
                    <p className="text-xs text-gray-600 font-secondary mt-0.5 truncate">{team.description}</p>
                  )}
                </div>
                <div className="px-2 py-1 bg-primary/10 rounded-full flex-shrink-0">
                  <span className="text-xs font-semibold text-primary font-secondary">
                    {allMembers.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Team Members List - Scrollable */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {allMembers.map((member) => {
                const isLeader = member._id === team.leader._id;
                return (
                  <motion.div
                    key={member._id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`relative p-2.5 rounded-lg border transition-all duration-300 ${
                      isLeader
                        ? 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30'
                        : 'bg-white border-gray-200/50 hover:border-primary/20'
                    }`}
                  >
                    {/* Leader Badge */}
                    {isLeader && (
                      <div className="absolute top-1 right-1 bg-gradient-to-r from-primary to-primary-dark text-white px-1.5 py-0.5 rounded-full shadow-md flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5" />
                        <span className="text-[10px] font-bold font-secondary">Leader</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2.5">
                      <UserAvatar
                        name={member.name}
                        image={member.profileImage}
                        size="md"
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-primary font-semibold text-gray-800 truncate">
                            {member.name}
                          </h3>
                          {employeesOnLeaveToday.includes(member._id) && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-orange-100 text-orange-800 flex items-center gap-0.5 font-secondary flex-shrink-0">
                              <Calendar className="w-2.5 h-2.5" />
                              On Leave
                            </span>
                          )}
                        </div>
                        <div className="space-y-0.5 mt-0.5">
                          <div className="flex items-center gap-1 text-xs text-gray-600 font-secondary">
                            <Mail className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="truncate">{member.email}</span>
                          </div>
                          {member.mobileNumber && (
                            <div className="flex items-center gap-1 text-xs text-gray-600 font-secondary">
                              <Phone className="w-2.5 h-2.5 flex-shrink-0" />
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
          </motion.div>
        );
      })}
    </div>
  );
}
