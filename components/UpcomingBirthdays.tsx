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
  daysUntil: number;
}

export default function UpcomingBirthdays() {
  const [birthdays, setBirthdays] = useState<BirthdayEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchUpcomingBirthdays = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/employees/upcoming-birthdays?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
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
    fetchUpcomingBirthdays();

    // Refetch when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUpcomingBirthdays();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Refetch when window gains focus
    const handleFocus = () => {
      fetchUpcomingBirthdays();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchUpcomingBirthdays]);

  const getBirthdayText = (daysUntil: number) => {
    if (daysUntil === 0) {
      return 'Today! 🎉';
    } else if (daysUntil === 1) {
      return 'Tomorrow';
    } else {
      return `${daysUntil} days`;
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
              {birthdays.length} {birthdays.length === 1 ? 'birthday' : 'birthdays'} • Celebrations
            </p>
          </div>
        </div>
        <div className="px-2.5 py-1 bg-pink-100 rounded-full flex items-center gap-1 flex-shrink-0">
          <span className="text-xs font-bold text-pink-700 font-primary">
            {birthdays.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingDots size="lg" className="mb-2" />
            <p className="text-sm text-gray-500 font-secondary mt-2">Loading birthdays...</p>
          </div>
        ) : birthdays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-base font-primary font-semibold text-gray-600 mb-1">No upcoming birthdays</p>
            <p className="text-sm text-gray-500 font-secondary">Birthdays will appear here</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {birthdays.map((employee, index) => {
              const birthdayText = getBirthdayText(employee.daysUntil);
              const isTodayBirthday = employee.daysUntil === 0;

              return (
                <motion.div
                  key={employee._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`group rounded-md transition-all duration-200 p-4 relative ${
                    isTodayBirthday
                      ? 'bg-pink-50 hover:bg-pink-100'
                      : 'bg-white hover:bg-gray-50'
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
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-2.5 h-2.5 text-gray-400" />
                          <span className="text-[10px] text-gray-500 font-secondary leading-tight">
                            {formatBirthdayDate(employee.dateOfBirth)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Days Badge */}
                    <div className="flex-shrink-0">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold font-secondary whitespace-nowrap ${
                        isTodayBirthday
                          ? 'bg-pink-500 text-white'
                          : 'bg-pink-100 text-pink-700'
                      }`}>
                        {birthdayText}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

