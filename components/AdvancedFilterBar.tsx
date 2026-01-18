'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Calendar, ChevronDown, X, Filter } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from 'date-fns';

interface FilterOption {
  value: string;
  label: string;
}

interface DatePreset {
  label: string;
  getValue: () => { from: string; to: string };
}

interface AdvancedFilterBarProps {
  searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  searchValue: string;
  filters: {
    label: string;
    key: string;
    type: 'select' | 'date' | 'dateRange';
    options?: FilterOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }[];
  onClearAll: () => void;
  hasActiveFilters: boolean;
  resultsCount?: number;
  totalCount?: number;
  showResultsCount?: boolean;
}

const datePresets: DatePreset[] = [
  {
    label: 'Today',
    getValue: () => {
      const today = new Date();
      const dateStr = format(today, 'yyyy-MM-dd');
      return {
        from: dateStr,
        to: dateStr,
      };
    },
  },
  {
    label: 'Last 7 days',
    getValue: () => {
      const to = new Date();
      const from = subDays(to, 6);
      return {
        from: format(from, 'yyyy-MM-dd'),
        to: format(to, 'yyyy-MM-dd'),
      };
    },
  },
  {
    label: 'Last 30 days',
    getValue: () => {
      const to = new Date();
      const from = subDays(to, 29);
      return {
        from: format(from, 'yyyy-MM-dd'),
        to: format(to, 'yyyy-MM-dd'),
      };
    },
  },
  {
    label: 'This Week',
    getValue: () => {
      const now = new Date();
      return {
        from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    },
  },
  {
    label: 'Last Week',
    getValue: () => {
      const lastWeek = subDays(new Date(), 7);
      return {
        from: format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        to: format(endOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    },
  },
  {
    label: 'This Month',
    getValue: () => {
      const now = new Date();
      return {
        from: format(startOfMonth(now), 'yyyy-MM-dd'),
        to: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
    },
  },
  {
    label: 'Last Month',
    getValue: () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return {
        from: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        to: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
      };
    },
  },
];

export default function AdvancedFilterBar({
  searchPlaceholder = 'Search...',
  onSearchChange,
  searchValue,
  filters,
  onClearAll,
  hasActiveFilters,
  resultsCount,
  totalCount,
  showResultsCount = true,
}: AdvancedFilterBarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [datePresetOpen, setDatePresetOpen] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const dateRangeRef = useRef<HTMLDivElement | null>(null);
  const presetRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      Object.keys(dropdownRefs.current).forEach((key) => {
        if (dropdownRefs.current[key] && !dropdownRefs.current[key]?.contains(event.target as Node)) {
          setOpenDropdown(null);
        }
      });
      if (dateRangeRef.current && !dateRangeRef.current.contains(event.target as Node)) {
        setDateRangeOpen(false);
      }
      if (presetRef.current && !presetRef.current.contains(event.target as Node)) {
        setDatePresetOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dateRangeFilter = filters.find((f) => f.type === 'dateRange');
  const fromFilter = dateRangeFilter ? filters.find((f) => f.key === `${dateRangeFilter.key}From`) : null;
  const toFilter = dateRangeFilter ? filters.find((f) => f.key === `${dateRangeFilter.key}To`) : null;

  // Set default to "Today" when component mounts and no dates are set
  useEffect(() => {
    if (dateRangeFilter && fromFilter && toFilter && !fromFilter.value && !toFilter.value) {
      const todayPreset = datePresets.find((p) => p.label === 'Today');
      if (todayPreset) {
        const { from, to } = todayPreset.getValue();
        fromFilter.onChange(from);
        toFilter.onChange(to);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Find which preset matches current date range
  const getCurrentPreset = useMemo(() => {
    if (!fromFilter?.value || !toFilter?.value) return 'Today'; // Default to "Today"
    
    for (const preset of datePresets) {
      const { from, to } = preset.getValue();
      if (from === fromFilter.value && to === toFilter.value) {
        return preset.label;
      }
    }
    return null;
  }, [fromFilter?.value, toFilter?.value]);

  const getFilterLabel = (filter: typeof filters[0]) => {
    if (filter.type === 'dateRange') {
      if (fromFilter?.value && toFilter?.value) {
        return `${format(new Date(fromFilter.value), 'dd MMM')} - ${format(new Date(toFilter.value), 'dd MMM')}`;
      }
      return getCurrentPreset || 'Select date range';
    }
    if (filter.type === 'date') {
      return filter.value ? format(new Date(filter.value), 'dd MMM yyyy') : filter.label;
    }
    const option = filter.options?.find((opt) => opt.value === filter.value);
    return option?.label || filter.label;
  };

  const applyDatePreset = (preset: DatePreset, filterKey: string) => {
    const { from, to } = preset.getValue();
    const fromFilter = filters.find((f) => f.key === `${filterKey}From`);
    const toFilter = filters.find((f) => f.key === `${filterKey}To`);
    if (fromFilter && toFilter) {
      fromFilter.onChange(from);
      toFilter.onChange(to);
    }
    setDatePresetOpen(false);
  };

  const selectFilters = filters.filter((f) => f.type === 'select');

  const getDisplayDateRange = () => {
    if (fromFilter?.value && toFilter?.value) {
      return `${format(new Date(fromFilter.value), 'dd MMM')} - ${format(new Date(toFilter.value), 'dd MMM')}`;
    }
    return 'Select dates';
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50/30 rounded-xl shadow-sm border border-gray-200/60 backdrop-blur-sm">
      {/* Results Count */}
      {showResultsCount && (resultsCount !== undefined || totalCount !== undefined) && (
        <div className="px-5 pt-4 pb-2">
          <div className="text-sm font-medium text-gray-700 font-secondary">
            {resultsCount !== undefined && totalCount !== undefined
              ? `Showing ${resultsCount} of ${totalCount} results`
              : resultsCount !== undefined
              ? `${resultsCount} results`
              : `${totalCount} total`}
          </div>
        </div>
      )}

      {/* Main Filter Bar */}
      <div className="px-5 pb-5">
        <div className="flex flex-wrap items-end gap-4">
          {/* Select Filters - Beautiful Horizontal Layout */}
          {selectFilters.map((filter) => {
            const isOpen = openDropdown === filter.key;
            return (
              <div key={filter.key} className="relative" ref={(el) => { dropdownRefs.current[filter.key] = el; }}>
                <label className="block text-xs font-semibold text-gray-700 mb-2 font-secondary">
                  {filter.label}
                </label>
                <button
                  onClick={() => setOpenDropdown(isOpen ? null : filter.key)}
                  className="min-w-[160px] px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:border-primary/40 hover:shadow-sm transition-all duration-200 font-secondary flex items-center justify-between gap-2 shadow-sm"
                >
                  <span className="truncate">{getFilterLabel(filter)}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-[9999] w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[300px] overflow-y-auto"
                    >
                      {filter.options?.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            filter.onChange(option.value);
                            setOpenDropdown(null);
                          }}
                          className={`w-full px-4 py-2.5 text-left text-sm font-secondary transition-colors ${
                            filter.value === option.value
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Date Range Filter - Beautiful Design */}
          {dateRangeFilter && (
            <div className="relative" ref={dateRangeRef}>
              <label className="block text-xs font-semibold text-gray-700 mb-2 font-secondary">
                {dateRangeFilter.label}
              </label>
              <div className="flex gap-2">
                {/* Quick Presets Dropdown */}
                <div className="relative" ref={presetRef}>
                  <button
                    onClick={() => setDatePresetOpen(!datePresetOpen)}
                    className={`min-w-[140px] px-4 py-2.5 text-sm font-medium bg-white border rounded-lg transition-all duration-200 font-secondary flex items-center justify-between gap-2 shadow-sm ${
                      getCurrentPreset
                        ? 'text-primary border-primary/40 bg-primary/5'
                        : 'text-gray-700 border-gray-300 hover:border-primary/40'
                    }`}
                  >
                    <span>{getCurrentPreset || 'Today'}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${datePresetOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {datePresetOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-[9999] w-[160px] mt-2 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
                      >
                        {datePresets.map((preset) => {
                          const isSelected = getCurrentPreset === preset.label;
                          return (
                            <button
                              key={preset.label}
                              onClick={() => applyDatePreset(preset, dateRangeFilter.key)}
                              className={`w-full px-4 py-2.5 text-left text-sm font-secondary transition-colors ${
                                isSelected
                                  ? 'bg-primary/10 text-primary font-semibold'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Custom Date Range Picker */}
                <button
                  onClick={() => {
                    setDateRangeOpen(!dateRangeOpen);
                    setDatePresetOpen(false);
                  }}
                  className={`min-w-[180px] px-4 py-2.5 text-sm font-medium bg-white border rounded-lg transition-all duration-200 font-secondary flex items-center gap-2 shadow-sm ${
                    fromFilter?.value && toFilter?.value && !getCurrentPreset
                      ? 'text-primary border-primary/40 bg-primary/5'
                      : 'text-gray-700 border-gray-300 hover:border-primary/40'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="flex-1 text-left">{getDisplayDateRange()}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${dateRangeOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Date Range Picker Dropdown */}
              <AnimatePresence>
                {dateRangeOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute z-[9999] right-0 mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-xl"
                  >
                    <div className="space-y-3 min-w-[300px]">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2 font-secondary">From Date</label>
                        <input
                          type="date"
                          value={fromFilter?.value || ''}
                          onChange={(e) => fromFilter?.onChange(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none font-secondary transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2 font-secondary">To Date</label>
                        <input
                          type="date"
                          value={toFilter?.value || ''}
                          onChange={(e) => toFilter?.onChange(e.target.value)}
                          min={fromFilter?.value || ''}
                          className="w-full px-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none font-secondary transition-all"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            if (fromFilter && toFilter) {
                              fromFilter.onChange('');
                              toFilter.onChange('');
                            }
                            setDateRangeOpen(false);
                          }}
                          className="flex-1 px-3 py-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors font-secondary"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => setDateRangeOpen(false)}
                          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors font-secondary shadow-sm"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Search Input - Beautiful Design */}
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-semibold text-gray-700 mb-2 font-secondary">Search</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none font-secondary transition-all shadow-sm hover:shadow-md"
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={onClearAll}
              className="bg-red-500 px-4 py-2.5 text-sm font-medium text-gray-100 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-all duration-200 font-secondary border border-gray-200 shadow-sm hover:shadow-md"
            >
              Clear All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
