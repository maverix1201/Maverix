'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Camera, Lock, Save, X, Calendar } from 'lucide-react';
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

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
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
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col items-center justify-center py-12">
          <LoadingDots size="lg" className="mb-3" />
          <p className="text-sm text-gray-500 font-secondary">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-primary font-semibold text-gray-800 mb-4">My Profile</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Picture */}
          <div className="flex items-center gap-6 mb-6">
            <div className="relative">
              {previewImage ? (
                <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-primary/20">
                  <Image
                    src={previewImage}
                    alt={profile?.name || 'Profile'}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/20">
                  {profile?.name ? (
                    <span className="text-2xl font-primary font-semibold text-primary">
                      {getUserInitials(profile.name)}
                    </span>
                  ) : (
                    <User className="w-10 h-10 text-primary" />
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full hover:bg-primary-dark transition-colors shadow-lg disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 font-secondary mb-1">Profile Picture</h3>
              <p className="text-xs text-gray-500 font-secondary">
                Click the camera icon to upload a new picture
              </p>
              {uploading && (
                <p className="text-xs text-primary font-secondary mt-1">Uploading...</p>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
              <User className="w-3 h-3 inline-block mr-1" />
              Full Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
            />
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
              <Mail className="w-3 h-3 inline-block mr-1" />
              Email Address
            </label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="w-full px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed font-secondary"
            />
            <p className="text-xs text-gray-500 mt-1 font-secondary">Email cannot be changed</p>
          </div>

          {/* Mobile Number */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
              <Phone className="w-3 h-3 inline-block mr-1" />
              Mobile Number
            </label>
            <input
              type="tel"
              value={formData.mobileNumber}
              onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
              placeholder="Enter mobile number"
              className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
            />
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
              <Calendar className="w-3 h-3 inline-block mr-1" />
              Date of Birth
            </label>
            <input
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
            />
            {profile?.dateOfBirth && (
              <p className="text-xs text-gray-500 mt-1 font-secondary">
                Current: {new Date(profile.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>

          {/* Role (Read-only) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
              Role
            </label>
            <input
              type="text"
              value={profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : ''}
              disabled
              className="w-full px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed font-secondary capitalize"
            />
          </div>

          {/* Password Section */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3 font-secondary flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Change Password
            </h3>
            <p className="text-xs text-gray-500 mb-3 font-secondary">
              Leave blank if you don&apos;t want to change your password
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
                  Current Password
                </label>
                <input
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
                  New Password
                </label>
                <input
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 font-secondary">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-secondary bg-white"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 font-secondary"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

