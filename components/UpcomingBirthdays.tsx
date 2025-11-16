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
      const res = await fetch('/api/employees/upcoming-birthdays');
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

  if (loading) {
    return (
      <div className="w-[400px] h-[400px] bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20 flex flex-col">
        <div className="flex flex-col items-center justify-center flex-1">
          <LoadingDots size="lg" className="mb-3" />
          <p className="text-sm text-gray-500 font-secondary">Loading birthdays...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px] h-[400px] bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20 flex flex-col overflow-visible sm:w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <div className="p-1.5 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg">
          <Gift className="w-4 h-4 text-white" />
        </div>
        <h2 className="text-lg font-primary font-bold text-gray-800">Upcoming Birthdays</h2>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto pr-2 overflow-x-visible">
        {birthdays.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-xs text-gray-600 font-secondary">No upcoming birthdays</p>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {birthdays.map((employee, index) => {
              const birthdayText = getBirthdayText(employee.daysUntil);
              const isTodayBirthday = employee.daysUntil === 0;
              const isMostRecent = index === 0; // First item is the most recent

              return (
                <motion.div
                  key={employee._id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative rounded-xl border-2 transition-all duration-300 overflow-visible ${isMostRecent
                      ? 'p-2 bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 border-pink-400 shadow-lg shadow-pink-200/50 transform hover:scale-[1.02]'
                      : isTodayBirthday
                        ? 'p-2.5 bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200 hover:border-pink-300'
                        : 'p-2.5 bg-white border-gray-200/50 hover:border-pink-200'
                    }`}
                >
                  <div className={`flex items-center gap-3 ${isMostRecent ? 'gap-3' : 'gap-2.5'}`}>
                    <div className={`relative ${isMostRecent ? 'ring-4 ring-white/50' : ''}`}>
                      <UserAvatar
                        name={employee.name}
                        image={employee.profileImage}
                        size={isMostRecent ? "lg" : "md"}
                        className="flex-shrink-0"
                      />
                      {isMostRecent && (
                        <div className="absolute -bottom-1 -right-1 bg-yellow-400 rounded-full p-1">
                          <Gift className="w-3 h-3 text-yellow-900" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                      <h3 className={`font-primary font-semibold truncate ${isMostRecent
                          ? 'text-white text-base'
                          : 'text-gray-800 text-sm'
                        }`}>
                        {employee.name}
                      </h3>
                      <span
                          className={`font-semibold font-secondary border border-gray-200 rounded-full px-3 py-1 ${isMostRecent
                              ? 'text-white text-[10px]'
                              : isTodayBirthday
                                ? 'text-pink-600 text-[10px]'
                                : 'text-gray-500 text-[10px]'
                            }`}
                        >
                          {birthdayText}
                        </span>
                        </div>
                      <div className={`flex items-center gap-2 mt-1 ${isMostRecent ? 'mt-1.5' : 'mt-0.5'
                        }`}>
                        <span className={`font-secondary ${isMostRecent
                            ? 'text-white/90 text-sm'
                            : 'text-gray-600 text-xs'
                          }`}>
                          {formatBirthdayDate(employee.dateOfBirth)}
                        </span>
                      </div>
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

