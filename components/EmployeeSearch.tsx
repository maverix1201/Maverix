'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Mail, Phone, User, Calendar, Briefcase } from 'lucide-react';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';
import Image from 'next/image';
import { format } from 'date-fns';

interface Employee {
  _id: string;
  name: string;
  email: string;
  mobileNumber?: string;
  profileImage?: string;
  empId?: string;
  role: string;
  dateOfBirth?: string;
  designation?: string;
}

export default function EmployeeSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeesOnLeaveToday, setEmployeesOnLeaveToday] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchEmployees = async () => {
      if (searchTerm.trim().length < 2) {
        setEmployees([]);
        setShowResults(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/employees/search?q=${encodeURIComponent(searchTerm)}`);
        const data = await res.json();

        if (res.ok) {
          setEmployees(data.employees || []);
          setShowResults(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchEmployees, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

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

  return (
    <div className="relative" ref={searchRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 z-10 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search employees by name or Emp ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchTerm.trim().length >= 2 && setShowResults(true)}
          className="w-full pl-12 pr-10 py-2 text-sm text-gray-700 bg-white/90 backdrop-blur-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-1 transition-all outline-none font-secondary shadow-sm"
        />
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              setEmployees([]);
              setShowResults(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results */}
      <AnimatePresence>
        {showResults && (employees.length > 0 || loading) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-96 overflow-y-auto"
          >
            {loading ? (
              <div className="p-4 text-center">
                <LoadingDots size="md" className="mb-2" />
                <p className="text-sm text-gray-500 font-secondary mt-2">Searching...</p>
              </div>
            ) : employees.length === 0 ? (
              <div className="p-4 text-center text-gray-500 font-secondary">No employees found</div>
            ) : (
              <div className="p-2">
                {employees.map((employee) => (
                  <motion.div
                    key={employee._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setSelectedEmployee(employee)}
                    className="p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={employee.name}
                        image={employee.profileImage}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-primary font-semibold text-gray-800 truncate">
                            {employee.name}
                          </h3>
                          {employeesOnLeaveToday.includes(employee._id) && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-orange-100 text-orange-800 flex items-center gap-0.5 font-secondary flex-shrink-0">
                              <Calendar className="w-2.5 h-2.5" />
                              On Leave
                            </span>
                          )}
                        </div>
                        <div className="space-y-0.5 mt-1">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 font-secondary">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{employee.email}</span>
                          </div>
                          {employee.mobileNumber && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600 font-secondary">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              <span>{employee.mobileNumber}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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

                  {/* Date of Birth */}
                  {selectedEmployee.dateOfBirth && (
                    <div className="flex items-center gap-2.5 py-1.5">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100/80 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-500 font-secondary mb-0.5">Date of Birth</p>
                        <p className="text-xs font-medium text-gray-800 font-secondary">
                          {format(new Date(selectedEmployee.dateOfBirth), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Designation */}
                  {selectedEmployee.designation && (
                    <div className="flex items-center gap-2.5 py-1.5">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100/80 flex items-center justify-center">
                        <Briefcase className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-500 font-secondary mb-0.5">Designation</p>
                        <p className="text-xs font-medium text-gray-800 font-secondary">
                          {selectedEmployee.designation}
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

