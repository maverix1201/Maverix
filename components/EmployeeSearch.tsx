'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Mail, Phone, User, Calendar } from 'lucide-react';
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
  role: string;
  dateOfBirth?: string;
}

export default function EmployeeSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
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

  return (
    <div className="relative" ref={searchRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 z-10 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search employees..."
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
                        <h3 className="text-sm font-primary font-semibold text-gray-800 truncate">
                          {employee.name}
                        </h3>
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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md border border-white/20"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-primary font-bold text-gray-800">Employee Details</h2>
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Profile Photo */}
                <div className="flex justify-center">
                  {selectedEmployee.profileImage ? (
                    <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-primary/20">
                      <Image
                        src={selectedEmployee.profileImage}
                        alt={selectedEmployee.name}
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/20">
                      <span className="text-2xl font-primary font-semibold text-primary">
                        {selectedEmployee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 font-secondary">
                    <User className="w-3 h-3 inline-block mr-1" />
                    Full Name
                  </label>
                  <p className="text-sm font-semibold text-gray-800 font-primary">
                    {selectedEmployee.name}
                  </p>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 font-secondary">
                    <Mail className="w-3 h-3 inline-block mr-1" />
                    Email Address
                  </label>
                  <p className="text-sm text-gray-800 font-secondary">
                    {selectedEmployee.email}
                  </p>
                </div>

                {/* Mobile Number */}
                {selectedEmployee.mobileNumber && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 font-secondary">
                      <Phone className="w-3 h-3 inline-block mr-1" />
                      Mobile Number
                    </label>
                    <p className="text-sm text-gray-800 font-secondary">
                      {selectedEmployee.mobileNumber}
                    </p>
                  </div>
                )}

                {/* Date of Birth */}
                {selectedEmployee.dateOfBirth && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 font-secondary">
                      <Calendar className="w-3 h-3 inline-block mr-1" />
                      Date of Birth
                    </label>
                    <p className="text-sm text-gray-800 font-secondary">
                      {format(new Date(selectedEmployee.dateOfBirth), 'MMM dd, yyyy')}
                    </p>
                  </div>
                )}

                {/* Role */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 font-secondary">
                    Role
                  </label>
                  <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize font-secondary">
                    {selectedEmployee.role}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="w-full px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-secondary"
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

