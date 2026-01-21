'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Mail, Phone, Crown, Calendar, X, User, Briefcase } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';
import Image from 'next/image';

interface TeamMember {
  _id: string;
  name: string;
  email: string;
  profileImage?: string;
  mobileNumber?: string;
  designation?: string;
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
  const [selectedEmployee, setSelectedEmployee] = useState<TeamMember | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState<string>('');
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

    // Refresh periodically (use events for instant updates)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchEmployeesOnLeave();
      }
    }, 30000);

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
                    onClick={() => {
                      setSelectedEmployee(member);
                      setSelectedTeamName(team.name);
                    }}
                    className={`group rounded-md transition-all duration-200 p-4 relative cursor-pointer ${
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

      {/* Employee Detail Modal */}
      <AnimatePresence>
        {selectedEmployee && (
          <div 
            className="fixed inset-0 bg-gradient-to-br from-black/50 via-black/40 to-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedEmployee(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-gradient-to-br from-white/95 via-white/90 to-white/95 backdrop-blur-2xl rounded-2xl p-5 w-full max-w-sm border border-white/30 shadow-2xl overflow-hidden"
            >
              {/* Glass effect overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
              
              {/* Close button */}
              <button
                onClick={() => setSelectedEmployee(null)}
                className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white/90 backdrop-blur-sm border border-white/30 text-gray-600 hover:text-gray-800 transition-all duration-200 shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative space-y-4">
                {/* Profile Photo & Name Section */}
                <div className="flex flex-col items-center pt-2">
                  <div className="relative">
                    {selectedEmployee.profileImage ? (
                      <div className="relative w-20 h-20 rounded-full overflow-hidden border-[3px] border-white/50 shadow-lg ring-2 ring-primary/20">
                        <Image
                          src={selectedEmployee.profileImage}
                          alt={selectedEmployee.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-[3px] border-white/50 shadow-lg ring-2 ring-primary/20">
                        <span className="text-xl font-primary font-bold text-primary">
                          {selectedEmployee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                    )}
                    {employeesOnLeaveToday.includes(selectedEmployee._id) && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-md">
                        <Calendar className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-primary font-bold text-gray-800 mt-3 text-center">
                    {selectedEmployee.name}
                  </h3>
                  {selectedEmployee.designation && (
                    <p className="text-xs font-semibold text-primary mt-1 px-3 py-1 bg-primary/10 rounded-full font-secondary">
                      {selectedEmployee.designation}
                    </p>
                  )}
                  {employeesOnLeaveToday.includes(selectedEmployee._id) && (
                    <span className="mt-2 px-2.5 py-1 text-[10px] font-semibold rounded-full bg-orange-100 text-orange-700 flex items-center gap-1 font-secondary">
                      <Calendar className="w-2.5 h-2.5" />
                      On Leave
                    </span>
                  )}
                </div>

                {/* Info Grid - Compact */}
                <div className="space-y-2.5 bg-white/40 backdrop-blur-sm rounded-xl p-3.5 border border-white/30">
                  {/* Team */}
                  {selectedTeamName && (
                    <div className="flex items-center gap-2.5 py-1.5">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100/80 flex items-center justify-center">
                        <Users className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-500 font-secondary mb-0.5">Team</p>
                        <p className="text-xs font-semibold text-gray-800 font-primary truncate">
                          {selectedTeamName}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  <div className="flex items-center gap-2.5 py-1.5">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100/80 flex items-center justify-center">
                      <Mail className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-500 font-secondary mb-0.5">Email</p>
                      <p className="text-xs font-medium text-gray-800 font-secondary truncate break-all">
                        {selectedEmployee.email}
                      </p>
                    </div>
                  </div>

                  {/* Mobile Number */}
                  {selectedEmployee.mobileNumber && (
                    <div className="flex items-center gap-2.5 py-1.5">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-100/80 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-500 font-secondary mb-0.5">Mobile</p>
                        <p className="text-xs font-medium text-gray-800 font-secondary">
                          {selectedEmployee.mobileNumber}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="w-full px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl hover:shadow-lg transition-all duration-200 font-secondary shadow-md hover:shadow-primary/20"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
