'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Briefcase, Calendar } from 'lucide-react';
import UserAvatar from './UserAvatar';
import { format } from 'date-fns';
import LoadingDots from './LoadingDots';

export default function EmployeeProfileCard() {
  const { data: session } = useSession();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchUserProfile();
      fetchProfileImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchUserProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (res.ok && data.user) {
        setUserProfile(data.user);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfileImage = async () => {
    try {
      const sessionImage = (session?.user as any)?.image || (session?.user as any)?.profileImage;
      if (sessionImage) {
        setProfileImage(sessionImage);
        return;
      }

      const res = await fetch('/api/profile/image');
      const data = await res.json();
      if (res.ok && data.profileImage) {
        setProfileImage(data.profileImage);
      }
    } catch (err) {
      console.error('Error fetching profile image:', err);
    }
  };

  const formatDateOfBirth = (dateString?: string) => {
    if (!dateString) return 'Not set';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Not set';
    }
  };

  return (
    <>
      <style jsx global>{`
        @keyframes shining-red-border {
          0%, 100% {
            box-shadow: 0 0 15px rgba(239, 68, 68, 0.6), 0 0 25px rgba(239, 68, 68, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          50% {
            box-shadow: 0 0 25px rgba(239, 68, 68, 0.9), 0 0 40px rgba(239, 68, 68, 0.6), 0 0 60px rgba(239, 68, 68, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
        }
      `}</style>
      {loading ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-md overflow-hidden border-2 border-red-500 h-[400px] flex flex-col"
          style={{
            background: 'var(--secondary)',
            animation: 'shining-red-border 2s ease-in-out infinite'
          }}
        >
          <div className="p-6 flex items-center justify-center flex-1">
            <LoadingDots size="md" />
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-md overflow-hidden border-2 border-blue-500 hover:shadow-xl transition-all h-[400px] flex flex-col"
          style={{
            background: 'var(--primary)',
            animation: 'shining-red-border 2s ease-in-out infinite'
          }}
        >
          {/* Header with Royal Blue Background */}
          <div className="p-6 relative overflow-hidden">
            <div className="relative z-10 flex items-center">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-white/30 shadow-xl ring-2 ring-white/20">
                    {profileImage || (session?.user as any)?.profileImage ? (
                      <img
                        src={profileImage || (session?.user as any)?.profileImage}
                        alt={userProfile?.name || session?.user?.name || 'User'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/20 flex items-center justify-center">
                        <User className="w-10 h-10 text-white" />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-primary">
                    {userProfile?.name || session?.user?.name || 'Employee'}
                  </h3>
                  {userProfile?.designation ? (
                    <p className="text-sm text-white/90 font-secondary mt-1">
                      {userProfile.designation}
                    </p>
                  ) : (
                    <p className="text-xs text-white/70 font-secondary italic mt-1">
                      No designation
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-6 space-y-4">
            {/* Email */}
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/70 font-secondary">Email</p>
                <p className="text-sm font-semibold text-white font-secondary truncate">
                  {userProfile?.email || session?.user?.email || 'N/A'}
                </p>
              </div>
            </div>

            {/* Mobile Number */}
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/70 font-secondary">Mobile</p>
                <p className="text-sm font-semibold text-white font-secondary">
                  {userProfile?.mobileNumber || 'Not set'}
                </p>
              </div>
            </div>

            {/* Designation */}
            {userProfile?.designation && (
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Briefcase className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 font-secondary">Designation</p>
                  <p className="text-sm font-semibold text-white font-secondary">
                    {userProfile.designation}
                  </p>
                </div>
              </div>
            )}

            {/* Date of Birth */}
            {userProfile?.dateOfBirth && (
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 font-secondary">Date of Birth</p>
                  <p className="text-sm font-semibold text-white font-secondary">
                    {formatDateOfBirth(userProfile.dateOfBirth)}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="w-full text-center justify-center items-center mb-2">
            <p className="text-sm font-semibold text-white font-secondary">
              http://mavericksmedia.org/
            </p>
          </div>
        </motion.div>
      )}
    </>
  );
}

