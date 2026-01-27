'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Gift } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';
import { format } from 'date-fns';

interface BirthdayEmployee {
  _id: string;
  name: string;
  email: string;
  profileImage?: string;
  dateOfBirth: string;
  designation?: string;
  daysUntil: number;
}

export default function UpcomingBirthdays() {
  const [birthdays, setBirthdays] = useState<BirthdayEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'thisMonth' | 'all'>('thisMonth');
  const toast = useToast();

  const fetchUpcomingBirthdays = useCallback(async (fetchAll: boolean = false) => {
    try {
      setLoading(true);
      const allParam = fetchAll ? '&all=true' : '';
      const res = await fetch(`/api/employees/upcoming-birthdays${allParam}`);
      const data = await res.json();

      if (res.ok) {
        setBirthdays(data.birthdays || []);
      } else {
        toast.error(data.error || 'Failed to fetch upcoming birthdays');
      }
    } catch (err: any) {
      toast.error('An error occurred while fetching upcoming birthdays');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUpcomingBirthdays(filterType === 'all');

    // Refetch when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUpcomingBirthdays(filterType === 'all');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Refetch when window gains focus
    const handleFocus = () => {
      fetchUpcomingBirthdays(filterType === 'all');
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchUpcomingBirthdays, filterType]);

  const getBirthdayText = (daysUntil: number) => {
    if (daysUntil === 0) {
      return 'Today! 🎉';
    } else if (daysUntil === 1) {
      return 'Tomorrow';
    } else {
      return `${daysUntil} days`;
    }
  };

  const getBadgeText = (daysUntil: number, dateOfBirth: string) => {
    if (daysUntil === 0) {
      return 'Today';
    } else if (daysUntil === 1) {
      return 'Tomorrow';
    } else {
      return formatBirthdayDate(dateOfBirth);
    }
  };

  const formatBirthdayDate = (dateOfBirth: string) => {
    try {
      const [year, month, day] = dateOfBirth.split('-').map(Number);
      return format(new Date(2000, month - 1, day), 'MMM dd');
    } catch (e) {
      return dateOfBirth;
    }
  };

  const getMonthFromBirthday = (dateOfBirth: string) => {
    try {
      const [year, month, day] = dateOfBirth.split('-').map(Number);
      return month;
    } catch (e) {
      return null;
    }
  };

  const getMonthName = (month: number) => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    return monthNames[month - 1] || '';
  };

  const getCurrentMonth = () => {
    return new Date().getMonth() + 1; // Returns 1-12
  };

  // Group and filter birthdays by current month
  const currentMonth = getCurrentMonth();
  const currentMonthBirthdays = birthdays.filter(employee => {
    const month = getMonthFromBirthday(employee.dateOfBirth);
    return month === currentMonth;
  });

  const displayedBirthdays = filterType === 'thisMonth' ? currentMonthBirthdays : birthdays;
  const displayedCount = displayedBirthdays.length;
  const displayMonthName = filterType === 'thisMonth' ? getMonthName(currentMonth) : 'All Months';

  return (
    <div className="bg-white rounded-md border border-gray-100 shadow-lg w-full h-[400px] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0 p-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-pink-100 rounded-md">
            <Gift className="w-3.5 h-3.5 text-pink-600" />
          </div>
          <div>
            <h2 className="text-sm font-primary font-bold text-gray-900">Upcoming Birthdays</h2>
            <p className="text-[9px] text-gray-500 font-secondary mt-0.5">
              {displayedCount} {displayedCount === 1 ? 'birthday' : 'birthdays'} • {displayMonthName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-md">
            <button
              onClick={() => setFilterType('thisMonth')}
              className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                filterType === 'thisMonth'
                  ? 'bg-pink-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {getMonthName(currentMonth)}
            </button>
            <button
              onClick={() => setFilterType('all')}
              className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                filterType === 'all'
                  ? 'bg-pink-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
          </div>
          <div className="px-2.5 py-1 bg-pink-100 rounded-full flex items-center gap-1 flex-shrink-0">
            <span className="text-xs font-bold text-pink-700 font-primary">
              {displayedCount}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingDots size="lg" className="mb-2" />
            <p className="text-sm text-gray-500 font-secondary mt-2">Loading birthdays...</p>
          </div>
        ) : displayedBirthdays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-base font-primary font-semibold text-gray-600 mb-1">
              {filterType === 'thisMonth' ? 'No birthdays this month' : 'No upcoming birthdays'}
            </p>
            <p className="text-sm text-gray-500 font-secondary">Upcoming birthdays will appear here</p>
          </div>
        ) : (
          <div>
            {filterType === 'all' ? (
              // Group by months for "All" view
              <div className="space-y-3">
                {Array.from({ length: 12 }, (_, i) => i + 1)
                  .map(month => {
                    const monthBirthdays = birthdays.filter(emp => getMonthFromBirthday(emp.dateOfBirth) === month);
                    if (monthBirthdays.length === 0) return null;
                    
                    return (
                      <div key={month} className="bg-pink-50 rounded-lg overflow-hidden">
                        {/* Month Header */}
                        <div className="flex items-center gap-2 px-4 py-3">
                          <div className="w-1 h-6 bg-pink-500 rounded-full" />
                          <h3 className="text-sm font-bold text-gray-900 font-primary">{getMonthName(month)}</h3>
                          <span className="text-[8px] text-pink-500 font-secondary ml-auto border border-pink-500 rounded-full px-1 py-0.5">{monthBirthdays.length} Birthdays</span>
                        </div>
                        
                        <div className="px-2 pb-2 space-y-1">
                          {monthBirthdays.map((employee, index) => {
                            const birthdayText = getBirthdayText(employee.daysUntil);
                            const isTodayBirthday = employee.daysUntil === 0;

                            return (
                              <motion.div
                                key={employee._id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className={`group rounded-md transition-all duration-200 p-3 relative ${
                                  isTodayBirthday
                                    ? 'bg-pink-200 border border-pink-500'
                                    : 'bg-white'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <UserAvatar
                                    name={employee.name}
                                    image={employee.profileImage}
                                    size="sm"
                                    className="flex-shrink-0"
                                  />
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold text-gray-900 font-primary leading-tight">
                                        {employee.name}
                                      </span>
                                      {employee.designation && (
                                        <span className="text-[10px] text-gray-400 font-secondary leading-tight mt-0.5">
                                          {employee.designation}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex-shrink-0">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold font-secondary whitespace-nowrap ${
                                      isTodayBirthday
                                        ? 'bg-pink-500 text-white'
                                        : employee.daysUntil === 1
                                        ? 'bg-pink-400 text-white'
                                        : 'bg-pink-100 text-pink-700'
                                    }`}>
                                      {getBadgeText(employee.daysUntil, employee.dateOfBirth)}
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                  .filter(Boolean)}
              </div>
            ) : (
              // Single month view for "This Month"
              <div className="bg-pink-50 rounded-lg overflow-hidden">
                {/* Month Header */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <div className="w-1 h-6 bg-pink-500 rounded-full" />
                  <h3 className="text-sm font-bold text-gray-900 font-primary">{getMonthName(currentMonth)}</h3>
                  <span className="text-[8px] text-pink-500 font-secondary ml-auto border border-pink-500 rounded-full px-1 py-0.5">{currentMonthBirthdays.length} Birthdays</span>
                </div>
                
                <div className="px-2 pb-2 space-y-1">
                  {currentMonthBirthdays.map((employee, index) => {
                    const birthdayText = getBirthdayText(employee.daysUntil);
                    const isTodayBirthday = employee.daysUntil === 0;

                    return (
                      <motion.div
                        key={employee._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`group rounded-md transition-all duration-200 p-3 relative ${
                          isTodayBirthday
                            ? 'bg-pink-200 border border-pink-500'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <UserAvatar
                            name={employee.name}
                            image={employee.profileImage}
                            size="sm"
                            className="flex-shrink-0"
                          />
                          
                          {/* Name and Date */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-gray-900 font-primary leading-tight">
                                {employee.name}
                              </span>
                              {employee.designation && (
                                <span className="text-[10px] text-gray-400 font-secondary leading-tight mt-0.5">
                                  {employee.designation}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Date Badge */}
                          <div className="flex-shrink-0">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold font-secondary whitespace-nowrap ${
                              isTodayBirthday
                                ? 'bg-pink-500 text-white'
                                : employee.daysUntil === 1
                                ? 'bg-pink-400 text-white'
                                : 'bg-pink-100 text-pink-700'
                            }`}>
                              {getBadgeText(employee.daysUntil, employee.dateOfBirth)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

