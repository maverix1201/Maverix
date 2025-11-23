'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit, Trash2, Users, UserCheck, Search, X, ChevronDown, Check } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';
import Pagination from './Pagination';

interface Employee {
  _id: string;
  name: string;
  email: string;
  profileImage?: string;
}

interface Team {
  _id: string;
  name: string;
  description?: string;
  leader: {
    _id: string;
    name: string;
    email: string;
  };
  members: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function TeamManagement() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; team: Team | null }>({
    isOpen: false,
    team: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leader: '',
    members: [] as string[],
  });
  const [leaderDropdownOpen, setLeaderDropdownOpen] = useState(false);
  const [leaderSearchTerm, setLeaderSearchTerm] = useState('');
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const leaderDropdownRef = useRef<HTMLDivElement>(null);
  const memberSearchRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      if (res.ok) {
        setTeams(data.teams);
      } else {
        toast.error(data.error || 'Failed to fetch teams');
      }
    } catch (err: any) {
      toast.error('An error occurred');
    }
  }, [toast]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.users || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch employees:', err);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
    fetchEmployees();
  }, [fetchTeams, fetchEmployees]);

  const handleOpenModal = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setFormData({
        name: team.name,
        description: team.description || '',
        leader: team.leader._id,
        members: team.members
          .filter((member) => member._id !== team.leader._id)
          .map((member) => member._id),
      });
    } else {
      setEditingTeam(null);
      setFormData({
        name: '',
        description: '',
        leader: '',
        members: [],
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTeam(null);
    setLeaderDropdownOpen(false);
    setLeaderSearchTerm('');
    setMemberSearchTerm('');
    setFormData({
      name: '',
      description: '',
      leader: '',
      members: [],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingTeam ? `/api/teams/${editingTeam._id}` : '/api/teams';
      const method = editingTeam ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save team');
        setLoading(false);
        return;
      }

      toast.success(editingTeam ? 'Team updated successfully' : 'Team created successfully');
      handleCloseModal();
      fetchTeams();
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const handleDeleteClick = (team: Team) => {
    setDeleteModal({ isOpen: true, team });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.team) return;

    const id = deleteModal.team._id;
    setDeleting(true);

    // Optimistic update
    const previousTeams = [...teams];
    setTeams(teams.filter((team) => team._id !== id));
    toast.success('Team deleted successfully');

    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        // Revert on error
        setTeams(previousTeams);
        toast.error('Failed to delete team');
        setDeleting(false);
        setDeleteModal({ isOpen: false, team: null });
        return;
      }

      setDeleting(false);
      setDeleteModal({ isOpen: false, team: null });
    } catch (err) {
      // Revert on error
      setTeams(previousTeams);
      toast.error('An error occurred');
      setDeleting(false);
      setDeleteModal({ isOpen: false, team: null });
    }
  };

  const toggleMember = (employeeId: string) => {
    if (formData.members.includes(employeeId)) {
      setFormData({
        ...formData,
        members: formData.members.filter((id) => id !== employeeId),
      });
    } else {
      setFormData({
        ...formData,
        members: [...formData.members, employeeId],
      });
    }
  };

  // Close leader dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (leaderDropdownRef.current && !leaderDropdownRef.current.contains(event.target as Node)) {
        setLeaderDropdownOpen(false);
      }
    };

    if (leaderDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [leaderDropdownOpen]);

  // Get team info for an employee (if they're a leader)
  const getEmployeeTeamAsLeader = (employeeId: string) => {
    if (editingTeam) {
      // When editing, check other teams (not current team)
      const team = teams.find(
        (t) => t._id !== editingTeam._id && t.leader._id === employeeId
      );
      return team;
    } else {
      // When creating, check all teams
      const team = teams.find((t) => t.leader._id === employeeId);
      return team;
    }
  };

  // Get team info for an employee (if they're a member)
  const getEmployeeTeamAsMember = (employeeId: string) => {
    if (editingTeam) {
      // When editing, check other teams (not current team)
      const team = teams.find(
        (t) =>
          t._id !== editingTeam._id &&
          t.members.some((member) => member._id === employeeId)
      );
      return team;
    } else {
      // When creating, check all teams
      const team = teams.find((t) =>
        t.members.some((member) => member._id === employeeId)
      );
      return team;
    }
  };

  // Check if employee is available for selection (not in any team)
  const isEmployeeAvailable = (employeeId: string) => {
    const teamAsLeader = getEmployeeTeamAsLeader(employeeId);
    const teamAsMember = getEmployeeTeamAsMember(employeeId);
    return !teamAsLeader && !teamAsMember;
  };

  // Filter employees for team leader dropdown - show all but filter by search
  const filteredLeaderEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(leaderSearchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(leaderSearchTerm.toLowerCase());
    return matchesSearch;
  });

  // Filter employees for team members - show all but exclude selected leader
  const filteredMemberEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(memberSearchTerm.toLowerCase());
    return matchesSearch && emp._id !== formData.leader;
  });

  const selectedLeader = employees.find((emp) => emp._id === formData.leader);

  const filteredTeams = useMemo(() => {
    return teams.filter((team) =>
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.leader.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teams, searchTerm]);

  // Pagination logic
  const paginatedTeams = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTeams.slice(startIndex, endIndex);
  }, [filteredTeams, currentPage]);

  const totalPages = Math.ceil(filteredTeams.length / itemsPerPage);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-primary font-semibold text-gray-800">Team Management</h2>
            <p className="text-sm text-gray-600 mt-0.5 font-secondary">
              Create and manage teams with assigned leaders
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="font-secondary">Create Team</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search teams by name, leader, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
          />
        </div>
      </div>

      {/* Teams List */}
      {filteredTeams.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-secondary">
            {searchTerm ? 'No teams found matching your search' : 'No teams created yet'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedTeams.map((team) => (
            <motion.div
              key={team._id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-primary font-semibold text-gray-800 mb-1">
                    {team.name}
                  </h3>
                  {team.description && (
                    <p className="text-sm text-gray-600 font-secondary mb-3">{team.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenModal(team)}
                    className="text-primary hover:text-primary-dark p-1.5 rounded hover:bg-primary-50 transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(team)}
                    className="text-red-600 hover:text-red-900 p-1.5 rounded hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <UserCheck className="w-4 h-4 text-primary" />
                  <span className="font-medium text-gray-700 font-secondary">Leader:</span>
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      name={team.leader.name}
                      image={(team.leader as any)?.profileImage}
                      size="sm"
                    />
                    <span className="text-gray-900 font-secondary">{team.leader.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-700 font-secondary">Members:</span>
                  <span className="text-gray-900 font-secondary">
                    {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </div>

              {/* Members List */}
              {team.members.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2 font-secondary">Team Members:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {team.members.slice(0, 5).map((member) => (
                      <span
                        key={member._id}
                        className={`text-xs px-2 py-1 rounded-full font-secondary ${
                          member._id === team.leader._id
                            ? 'bg-primary-100 text-primary font-semibold'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {member.name}
                        {member._id === team.leader._id && ' (Leader)'}
                      </span>
                    ))}
                    {team.members.length > 5 && (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-secondary">
                        +{team.members.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredTeams.length}
                itemsPerPage={itemsPerPage}
              />
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal with Glass Effect */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-primary font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  {editingTeam ? 'Edit Team' : 'Create Team'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Team Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 font-secondary">
                    Team Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-3 text-sm text-gray-700 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm shadow-sm transition-all"
                    placeholder="Enter team name"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 font-secondary">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 text-sm text-gray-700 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm shadow-sm transition-all resize-none"
                    placeholder="Enter team description (optional)"
                  />
                </div>

                {/* Team Leader Dropdown with Profile Picture */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 font-secondary">
                    Team Leader *
                  </label>
                  <div className="relative" ref={leaderDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setLeaderDropdownOpen(!leaderDropdownOpen);
                        setLeaderSearchTerm('');
                      }}
                      className={`w-full px-4 py-3 text-sm text-left border rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm shadow-sm transition-all flex items-center justify-between ${
                        formData.leader
                          ? 'border-primary/30 text-gray-700'
                          : 'border-gray-300/50 text-gray-500'
                      }`}
                    >
                      {selectedLeader ? (
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={selectedLeader.name}
                            image={selectedLeader.profileImage}
                            size="sm"
                          />
                          <div className="flex flex-col">
                            <span className="text-gray-900 font-medium">{selectedLeader.name}</span>
                            <span className="text-xs text-gray-500">{selectedLeader.email}</span>
                          </div>
                        </div>
                      ) : (
                        <span>Select Team Leader</span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          leaderDropdownOpen ? 'transform rotate-180' : ''
                        }`}
                      />
                    </button>

                    <AnimatePresence>
                      {leaderDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 overflow-hidden"
                        >
                          {/* Search in Leader Dropdown */}
                          <div className="p-3 border-b border-gray-200/50">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                              <input
                                type="text"
                                value={leaderSearchTerm}
                                onChange={(e) => setLeaderSearchTerm(e.target.value)}
                                placeholder="Search employees..."
                                className="w-full pl-10 pr-4 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>

                          <div className="max-h-60 overflow-y-auto">
                            {filteredLeaderEmployees.length === 0 ? (
                              <div className="p-4 text-center text-sm text-gray-500">
                                {leaderSearchTerm ? 'No employees found' : 'No employees available'}
                              </div>
                            ) : (
                              filteredLeaderEmployees.map((emp) => {
                                const teamAsLeader = getEmployeeTeamAsLeader(emp._id);
                                const teamAsMember = getEmployeeTeamAsMember(emp._id);
                                const isAvailable = isEmployeeAvailable(emp._id);
                                const isSelected = formData.leader === emp._id;

                                return (
                                  <button
                                    key={emp._id}
                                    type="button"
                                    onClick={() => {
                                      if (isAvailable || isSelected) {
                                        setFormData({ ...formData, leader: emp._id });
                                        setLeaderDropdownOpen(false);
                                        setLeaderSearchTerm('');
                                      }
                                    }}
                                    disabled={!isAvailable && !isSelected}
                                    className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                                      isSelected
                                        ? 'bg-primary/10'
                                        : isAvailable
                                        ? 'hover:bg-primary/5 cursor-pointer'
                                        : 'opacity-60 cursor-not-allowed bg-gray-50/50'
                                    }`}
                                  >
                                    <UserAvatar
                                      name={emp.name}
                                      image={emp.profileImage}
                                      size="sm"
                                    />
                                    <div className="flex-1 text-left">
                                      <div className="flex items-center gap-2">
                                        <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                                        {teamAsLeader && (
                                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                            Leader: {teamAsLeader.name}
                                          </span>
                                        )}
                                        {teamAsMember && !teamAsLeader && (
                                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                                            {teamAsMember.name}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500">{emp.email}</div>
                                    </div>
                                    {isSelected && (
                                      <Check className="w-4 h-4 text-primary" />
                                    )}
                                    {!isAvailable && !isSelected && (
                                      <span className="text-xs text-gray-400">Unavailable</span>
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Team Members with Search */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 font-secondary">
                    Team Members
                  </label>
                  
                  {/* Search Box for Members */}
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 z-10 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        ref={memberSearchRef}
                        type="text"
                        value={memberSearchTerm}
                        onChange={(e) => setMemberSearchTerm(e.target.value)}
                        placeholder="Search team members..."
                        className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-700 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Members Selection */}
                  <div className="border border-gray-300/50 rounded-xl p-4 max-h-64 overflow-y-auto bg-white/50 backdrop-blur-sm shadow-inner">
                    {filteredMemberEmployees.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500 font-secondary">
                          {memberSearchTerm ? 'No employees found' : 'No employees available'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredMemberEmployees.map((emp) => {
                          const isSelected = formData.members.includes(emp._id);
                          const teamAsLeader = getEmployeeTeamAsLeader(emp._id);
                          const teamAsMember = getEmployeeTeamAsMember(emp._id);
                          const isAvailable = isEmployeeAvailable(emp._id);

                          return (
                            <label
                              key={emp._id}
                              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                                isSelected
                                  ? 'bg-primary/10 border-2 border-primary/30 shadow-sm cursor-pointer'
                                  : isAvailable
                                  ? 'bg-white/80 border border-gray-200/50 hover:bg-primary/5 hover:border-primary/20 cursor-pointer'
                                  : 'bg-gray-50/50 border border-gray-200/30 opacity-60 cursor-not-allowed'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isAvailable || isSelected) {
                                    toggleMember(emp._id);
                                  }
                                }}
                                disabled={!isAvailable && !isSelected}
                                className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <UserAvatar
                                name={emp.name}
                                image={emp.profileImage}
                                size="sm"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                                  {teamAsLeader && (
                                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                      Leader: {teamAsLeader.name}
                                    </span>
                                  )}
                                  {teamAsMember && !teamAsLeader && (
                                    <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                                      {teamAsMember.name}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">{emp.email}</div>
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-primary" />
                              )}
                              {!isAvailable && !isSelected && (
                                <span className="text-xs text-gray-400">Unavailable</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 font-secondary">
                    Note: The team leader is automatically included as a member
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-3 text-sm border border-gray-300/50 rounded-xl text-gray-700 hover:bg-gray-50/80 transition-all font-secondary backdrop-blur-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 text-sm bg-gradient-to-r from-primary to-purple-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 font-secondary flex items-center justify-center gap-2 backdrop-blur-sm"
                  >
                    {loading ? (
                      <>
                        <LoadingDots size="sm" color="white" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      editingTeam ? 'Update Team' : 'Create Team'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, team: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Team"
        message="Are you sure you want to delete this team?"
        details={
          deleteModal.team ? (
            <div className="space-y-1">
              <div>
                <span className="font-semibold">Team Name:</span> {deleteModal.team.name}
              </div>
              {deleteModal.team.description && (
                <div>
                  <span className="font-semibold">Description:</span> {deleteModal.team.description}
                </div>
              )}
              <div>
                <span className="font-semibold">Leader:</span> {deleteModal.team.leader.name}
              </div>
              <div>
                <span className="font-semibold">Members:</span> {deleteModal.team.members.length}
              </div>
            </div>
          ) : null
        }
        loading={deleting}
      />
    </div>
  );
}

