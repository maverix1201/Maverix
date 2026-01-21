'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, User, Calendar, Phone, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserProfile {
  name?: string;
  email?: string;
  mobileNumber?: string;
  dateOfBirth?: string;
  joiningYear?: number;
  profileImage?: string;
}

interface MissingField {
  name: string;
  icon: React.ReactNode;
}

export default function ProfileCompletionBanner() {
  const { data: session } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const userId = (session?.user as any)?.id as string | undefined;

  useEffect(() => {
    // Try fast in-memory/sessionStorage cache to avoid refetching on every route change.
    const cacheKey = userId ? `profileCompletionBanner:${userId}` : null;
    if (cacheKey) {
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as { ts: number; profile: UserProfile };
          // Cache is short-lived; correctness still converges via profileUpdated event.
          if (parsed?.ts && Date.now() - parsed.ts < 5 * 60 * 1000) {
            setProfile(parsed.profile);
            setLoading(false);
          }
        }
      } catch {
        // ignore cache errors
      }
    }

    fetchProfile({ force: !cacheKey }); // if we can't cache, ensure we fetch

    // Refresh profile when page becomes visible (user might have updated profile)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchProfile();
      }
    };

    // Listen for custom event when profile is updated
    const handleProfileUpdate = () => {
      // Invalidate cache and refetch
      const cacheKeyInner = userId ? `profileCompletionBanner:${userId}` : null;
      if (cacheKeyInner) {
        try {
          sessionStorage.removeItem(cacheKeyInner);
        } catch {
          // ignore
        }
      }
      setTimeout(() => fetchProfile({ force: true }), 500);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [userId]);

  const fetchProfile = async (opts?: { force?: boolean }) => {
    try {
      // Throttle background refreshes to keep navigation snappy
      const cacheKey = userId ? `profileCompletionBanner:${userId}` : null;
      if (!opts?.force && cacheKey) {
        try {
          const raw = sessionStorage.getItem(cacheKey);
          if (raw) {
            const parsed = JSON.parse(raw) as { ts: number; profile: UserProfile };
            if (parsed?.ts && Date.now() - parsed.ts < 60 * 1000) {
              return; // refreshed recently
            }
          }
        } catch {
          // ignore
        }
      }

      if (!profile) setLoading(true);
      // Get basic profile fields (fast endpoint)
      const profileReq = fetch('/api/profile', { cache: 'no-store' });

      // Get profile image (separate endpoint) OR session image if already present
      const sessionImage =
        (session?.user as any)?.image || (session?.user as any)?.profileImage || null;

      const imageReq = sessionImage
        ? Promise.resolve({ ok: true, json: async () => ({ profileImage: sessionImage }) } as Response)
        : fetch('/api/profile/image', { cache: 'no-store' });

      const [profileRes, imageRes] = await Promise.all([profileReq, imageReq]);
      const profileData = await profileRes.json();
      const imageData = imageRes.ok ? await imageRes.json() : { profileImage: null };

      if (profileRes.ok && profileData.user) {
        const nextProfile = {
          ...profileData.user,
          profileImage: imageData?.profileImage || profileData.user?.profileImage,
        } as UserProfile;

        setProfile(nextProfile);

        if (cacheKey) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), profile: nextProfile }));
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // Check which fields are missing
  const getMissingFields = (): MissingField[] => {
    if (!profile) return [];

    const missing: MissingField[] = [];

    if (!profile.name || profile.name.trim() === '') {
      missing.push({ name: 'Full Name', icon: <User className="w-4 h-4" /> });
    }

    if (!profile.joiningYear) {
      missing.push({ name: 'Joining Year', icon: <Calendar className="w-4 h-4" /> });
    }

    if (!profile.mobileNumber || profile.mobileNumber.trim() === '') {
      missing.push({ name: 'Mobile Number', icon: <Phone className="w-4 h-4" /> });
    }

    if (!profile.dateOfBirth) {
      missing.push({ name: 'Date of Birth', icon: <Calendar className="w-4 h-4" /> });
    }

    if (!profile.profileImage) {
      missing.push({ name: 'Profile Picture', icon: <Camera className="w-4 h-4" /> });
    }

    return missing;
  };

  const missingFields = getMissingFields();
  const isProfileComplete = missingFields.length === 0;
  const userName = profile?.name || session?.user?.name || 'User';
  const firstName = userName.split(' ')[0];

  // Don't show banner if profile is complete or dismissed
  if (loading || isProfileComplete || dismissed) {
    return null;
  }

  const getProfileRoute = () => {
    const role = (session?.user as any)?.role;
    if (role === 'admin') return '/admin/profile';
    if (role === 'hr') return '/hr/profile';
    return '/employee/profile';
  };

  const visibleMissingFields = missingFields.slice(0, 3);
  const remainingMissingCount = Math.max(0, missingFields.length - visibleMissingFields.length);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="w-full bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 border-b border-orange-200 shadow-sm z-50"
      >
        <div className="max-w-7xl mx-auto px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0">
              <div className="p-1.5 bg-orange-100 rounded-full">
                <AlertCircle className="w-4 h-4 text-orange-600" />
              </div>
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-2">
              <p className="text-xs font-primary font-semibold text-gray-900 whitespace-nowrap">
                Hi {firstName}, complete your profile
              </p>
              <span className="text-xs text-gray-500">•</span>
              <div className="min-w-0 flex items-center gap-1.5 overflow-hidden">
                <span className="text-xs text-gray-700 font-secondary font-semibold whitespace-nowrap">
                  Missing:
                </span>
                <div className="min-w-0 flex items-center gap-1.5 overflow-hidden">
                  {visibleMissingFields.map((field, idx) => (
                    <span
                      key={`${field.name}-${idx}`}
                      title={field.name}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-orange-200 bg-white/70 text-[11px] text-gray-800 font-secondary whitespace-nowrap shadow-[0_1px_0_rgba(0,0,0,0.03)]"
                    >
                      <span className="text-orange-600 flex-shrink-0">
                        {field.icon}
                      </span>
                      <span className="hidden md:inline">{field.name}</span>
                    </span>
                  ))}
                  {remainingMissingCount > 0 && (
                    <span
                      title={`${remainingMissingCount} more`}
                      className="inline-flex items-center px-2 py-0.5 rounded-full border border-orange-200 bg-white/70 text-[11px] text-gray-700 font-secondary whitespace-nowrap"
                    >
                      +{remainingMissingCount} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push(getProfileRoute())}
              className="flex-shrink-0 inline-flex items-center px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-md text-xs font-semibold transition-all shadow-sm hover:shadow-md"
            >
              Complete
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-md transition-all"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
