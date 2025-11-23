'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Camera, Lock, Save, X, Calendar, Edit3, Shield, UserCircle, Sparkles } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import Image from 'next/image';
import LoadingDots from './LoadingDots';

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: string;
  profileImage?: string;
  mobileNumber?: string;
  dateOfBirth?: string;
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    mobileNumber: '',
    dateOfBirth: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/profile');
      const data = await res.json();

      if (res.ok) {
        setProfile(data.user);
        // Format dateOfBirth for date input (YYYY-MM-DD format)
        // Handle timezone issues by using local date instead of UTC
        let formattedDOB = '';
        if (data.user.dateOfBirth) {
          try {
            const dobDate = new Date(data.user.dateOfBirth);
            if (!isNaN(dobDate.getTime())) {
              // Use local date to avoid timezone shifts
              const year = dobDate.getFullYear();
              const month = String(dobDate.getMonth() + 1).padStart(2, '0');
              const day = String(dobDate.getDate()).padStart(2, '0');
              formattedDOB = `${year}-${month}-${day}`;
            }
          } catch (e) {
            console.error('Error formatting dateOfBirth:', e);
          }
        }
        setFormData({
          name: data.user.name || '',
          mobileNumber: data.user.mobileNumber || '',
          dateOfBirth: formattedDOB,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setPreviewImage(data.user.profileImage || null);
      } else {
        toast.error(data.error || 'Failed to fetch profile');
      }
    } catch (err: any) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB for base64 encoding)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    try {
      setUploading(true);
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const uploadRes = await fetch('/api/profile/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const uploadData = await uploadRes.json();

      if (uploadRes.ok) {
        // Update profile with new image URL
        const updateRes = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileImage: uploadData.url }),
        });

        const updateData = await updateRes.json();

        if (updateRes.ok) {
          setProfile(updateData.user);
          toast.success('Profile picture updated successfully');
        } else {
          toast.error(updateData.error || 'Failed to update profile picture');
        }
      } else {
        toast.error(uploadData.error || 'Failed to upload image');
        setPreviewImage(profile?.profileImage || null);
      }
    } catch (err: any) {
      toast.error('An error occurred while uploading');
      setPreviewImage(profile?.profileImage || null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate password if provided
      if (formData.newPassword) {
        if (formData.newPassword.length < 6) {
          toast.error('Password must be at least 6 characters');
          setSaving(false);
          return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
          toast.error('New passwords do not match');
          setSaving(false);
          return;
        }

        if (!formData.currentPassword) {
          toast.error('Please enter your current password');
          setSaving(false);
          return;
        }
      }

      const updateData: any = {
        name: formData.name,
        mobileNumber: formData.mobileNumber || null,
        dateOfBirth: formData.dateOfBirth && formData.dateOfBirth.trim() !== '' ? formData.dateOfBirth : null,
      };

      if (formData.currentPassword && formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (res.ok) {
        setProfile(data.user);
        // Format dateOfBirth for date input (YYYY-MM-DD format)
        // Handle timezone issues by using local date instead of UTC
        let formattedDOB = '';
        if (data.user.dateOfBirth) {
          try {
            const dobDate = new Date(data.user.dateOfBirth);
            if (!isNaN(dobDate.getTime())) {
              // Use local date to avoid timezone shifts
              const year = dobDate.getFullYear();
              const month = String(dobDate.getMonth() + 1).padStart(2, '0');
              const day = String(dobDate.getDate()).padStart(2, '0');
              formattedDOB = `${year}-${month}-${day}`;
            }
          } catch (e) {
            console.error('Error formatting dateOfBirth:', e);
          }
        }
        setFormData({
          name: data.user.name || '',
          mobileNumber: data.user.mobileNumber || '',
          dateOfBirth: formattedDOB,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        toast.success('Profile updated successfully');
      } else {
        toast.error(data.error || 'Failed to update profile');
      }
    } catch (err: any) {
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const getUserInitials = (name: string) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  };

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-8 border border-white/50">
        <div className="flex flex-col items-center justify-center py-8">
          <LoadingDots size="lg" className="mb-3" />
          <p className="text-sm text-gray-500 font-secondary">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Profile Picture Section */}


        {/* Personal Information Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <User className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-primary font-bold text-gray-800">Personal Information</h2>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50"
          >
            <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
              <div className="relative group">
                <div className="relative">
                  {previewImage ? (
                    <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-gradient-to-br from-blue-400 to-purple-400 shadow-lg ring-2 ring-white/50">
                      <Image
                        src={previewImage}
                        alt={profile?.name || 'Profile'}
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-blue-400 via-indigo-400 to-purple-400 flex items-center justify-center border-2 border-white/50 shadow-lg ring-2 ring-white/50">
                      {profile?.name ? (
                        <span className="text-3xl font-primary font-bold text-white">
                          {getUserInitials(profile.name)}
                        </span>
                      ) : (
                        <User className="w-12 h-12 text-white" />
                      )}
                    </div>
                  )}
                  <motion.button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute -bottom-1 -right-1 p-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed z-10 border-2 border-white"
                  >
                    {uploading ? (
                      <LoadingDots size="sm" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </motion.button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
                {uploading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center backdrop-blur-sm"
                  >
                    <div className="text-white text-xs font-secondary">Uploading...</div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-primary font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-500" />
                Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 text-sm text-gray-700 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-secondary bg-white transition-all hover:border-gray-300"
                placeholder="Enter your full name"
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-xs font-primary font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-500" />
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full px-3 py-2 text-sm text-gray-500 border-2 border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed font-secondary"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <Shield className="w-3.5 h-3.5 text-gray-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1 font-secondary flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Email cannot be changed
              </p>
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-primary font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-500" />
                Mobile Number
              </label>
              <input
                type="tel"
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                placeholder="+1 (555) 123-4567"
                className="w-full px-3 py-2 text-sm text-gray-700 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-secondary bg-white transition-all hover:border-gray-300"
              />
            </div>

            {/* Date of Birth */}
            <div>
              <label className="text-xs font-primary font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Date of Birth
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 text-sm text-gray-700 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-secondary bg-white transition-all hover:border-gray-300"
              />
            </div>

            {/* Role (Read-only) */}
            <div>
              <label className="block text-xs font-primary font-semibold text-gray-700 mb-1.5">
                Role
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : ''}
                  disabled
                  className="w-full px-3 py-2 text-sm text-gray-500 border-2 border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed font-secondary capitalize"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <Shield className="w-3.5 h-3.5 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Password Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-primary font-bold text-gray-800">Change Password</h2>
              <p className="text-xs text-gray-500 font-secondary">
                Leave blank if you don&apos;t want to change your password
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-primary font-semibold text-gray-700 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                placeholder="Enter current password"
                className="w-full px-3 py-2 text-sm text-gray-700 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none font-secondary bg-white transition-all hover:border-gray-300"
              />
            </div>

            <div>
              <label className="block text-xs font-primary font-semibold text-gray-700 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                placeholder="Enter new password"
                className="w-full px-3 py-2 text-sm text-gray-700 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none font-secondary bg-white transition-all hover:border-gray-300"
              />
            </div>

            <div>
              <label className="block text-xs font-primary font-semibold text-gray-700 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
                className="w-full px-3 py-2 text-sm text-gray-700 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none font-secondary bg-white transition-all hover:border-gray-300"
              />
            </div>
          </div>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="flex justify-end"
        >
          <motion.button
            type="submit"
            disabled={saving}
            whileHover={{ scale: saving ? 1 : 1.02 }}
            whileTap={{ scale: saving ? 1 : 0.98 }}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-secondary font-semibold text-sm"
          >
            {saving ? (
              <>
                <LoadingDots size="sm" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </motion.button>
        </motion.div>
      </form>
    </div>
  );
}

