'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Calendar, X, Send, Megaphone, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import { useSession } from 'next-auth/react';
import UserAvatar from './UserAvatar';
import LoadingDots from './LoadingDots';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface Announcement {
  _id: string;
  title: string;
  content: string;
  date: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
    role: string;
  };
  createdAt: string;
  views?: Array<{
    userId: string;
    viewCount: number;
  }>;
}

export default function AnnouncementManagement() {
  const { data: session } = useSession();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; announcement: Announcement | null }>({
    isOpen: false,
    announcement: null,
  });
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get today's date in YYYY-MM-DD format for min date
  const getTodayDate = () => {
    const today = new Date();
    return format(today, 'yyyy-MM-dd');
  };

  const fetchAnnouncements = useCallback(async () => {
    try {
      setFetching(true);
      const res = await fetch('/api/announcements');
      const data = await res.json();
      if (res.ok) {
        setAnnouncements(data.announcements || []);
      } else {
        toast.error(data.error || 'Failed to fetch announcements');
      }
    } catch (err: any) {
      console.error('Error fetching announcements:', err);
      toast.error('Failed to load announcements');
    } finally {
      setFetching(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = editingAnnouncement
        ? `/api/announcements/${editingAnnouncement._id}`
        : '/api/announcements';
      const method = editingAnnouncement ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(
          editingAnnouncement
            ? 'Announcement updated successfully!'
            : 'Announcement created successfully!'
        );
        setFormData({
          title: '',
          content: '',
          date: format(new Date(), 'yyyy-MM-dd'),
        });
        setShowModal(false);
        setEditingAnnouncement(null);
        fetchAnnouncements();
      } else {
        setError(data.error || `Failed to ${editingAnnouncement ? 'update' : 'create'} announcement`);
        toast.error(data.error || `Failed to ${editingAnnouncement ? 'update' : 'create'} announcement`);
      }
    } catch (err: any) {
      console.error(`Error ${editingAnnouncement ? 'updating' : 'creating'} announcement:`, err);
      setError(`Failed to ${editingAnnouncement ? 'update' : 'create'} announcement`);
      toast.error(`Failed to ${editingAnnouncement ? 'update' : 'create'} announcement`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      date: format(new Date(announcement.date), 'yyyy-MM-dd'),
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteModal.announcement) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/announcements/${deleteModal.announcement._id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Announcement deleted successfully!');
        setDeleteModal({ isOpen: false, announcement: null });
        fetchAnnouncements();
      } else {
        toast.error(data.error || 'Failed to delete announcement');
      }
    } catch (err: any) {
      console.error('Error deleting announcement:', err);
      toast.error('Failed to delete announcement');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditingAnnouncement(null);
    setFormData({
      title: '',
      content: '',
      date: format(new Date(), 'yyyy-MM-dd'),
    });
    setError('');
  };

  const getTotalViews = (announcement: Announcement) => {
    if (!announcement.views || announcement.views.length === 0) return 0;
    return announcement.views.reduce((sum, view) => sum + (view.viewCount || 0), 0);
  };

  const getUniqueViewers = (announcement: Announcement) => {
    if (!announcement.views) return 0;
    return announcement.views.length;
  };

  const canEditOrDelete = (announcement: Announcement) => {
    const currentUserId = (session?.user as any)?.id;
    const userRole = (session?.user as any)?.role;
    // Admin can edit/delete any, others can only edit/delete their own
    return (
      userRole === 'admin' ||
      announcement.createdBy._id === currentUserId
    );
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
            <Megaphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-primary font-bold text-gray-800">Announcements</h2>
            <p className="text-sm text-gray-600 font-secondary">Manage and create announcements for employees</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setEditingAnnouncement(null);
            setFormData({
              title: '',
              content: '',
              date: format(new Date(), 'yyyy-MM-dd'),
            });
            setError('');
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-shadow font-secondary font-semibold"
        >
          <Plus className="w-5 h-5" />
          Create Announcement
        </motion.button>
      </div>

      {/* Announcements List */}
      {fetching ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-12 flex flex-col items-center justify-center border border-white/50 ">
          <LoadingDots size="lg" className="mb-3" />
          <p className="text-sm text-gray-500 font-secondary">Loading announcements...</p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-12 flex flex-col items-center justify-center border border-white/50">
          <Megaphone className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-lg font-primary font-semibold text-gray-600 mb-2">No announcements yet</p>
          <p className="text-sm text-gray-500 font-secondary">Create your first announcement to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          {announcements.map((announcement, index) => (
            <motion.div
              key={announcement._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className=" bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow h-full flex flex-col"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <UserAvatar
                    name={announcement.createdBy.name}
                    image={announcement.createdBy.profileImage}
                    size="sm"
                  />
                  <div>
                    <p className="text-sm font-primary font-semibold text-gray-800">
                      {announcement.createdBy.name}
                    </p>
                    <p className="text-xs text-gray-500 font-secondary capitalize">
                      {announcement.createdBy.role}
                    </p>
                  </div>
                </div>
                {canEditOrDelete(announcement) && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleEdit(announcement)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit announcement"
                    >
                      <Edit2 className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setDeleteModal({ isOpen: true, announcement })}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete announcement"
                    >
                      <Trash2 className="w-5 h-5" />
                    </motion.button>
                  </div>
                )}
              </div>
              <div className="flex-1 flex flex-col">
                <h3 className="text-xl font-primary font-bold text-gray-800 mb-2">
                  {announcement.title}
                </h3>
                <p className="text-sm text-gray-600 font-secondary whitespace-pre-wrap mb-4 flex-1">
                  {announcement.content}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500 font-secondary mt-auto">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(announcement.date), 'MMM dd, yyyy')}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Announcement Modal */}
      {mounted && createPortal(
        <AnimatePresence mode="wait">
          {showModal && (
            <motion.div
              key="announcement-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
              onClick={() => !loading && handleCancel()}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative"
              >
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                      <Megaphone className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-primary font-bold text-gray-800">
                      {editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}
                    </h3>
                  </div>
                  <button
                    onClick={handleCancel}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 font-secondary">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-primary font-semibold text-gray-700 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-secondary"
                      placeholder="Enter announcement title"
                      required
                      maxLength={200}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-primary font-semibold text-gray-700 mb-2">
                      Content *
                    </label>
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-secondary min-h-[200px] resize-y"
                      placeholder="Enter announcement content"
                      required
                      maxLength={5000}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-primary font-semibold text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      min={getTodayDate()}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-secondary"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-shadow font-secondary font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <LoadingDots size="sm" />
                          <span>{editingAnnouncement ? 'Updating...' : 'Creating...'}</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          <span>{editingAnnouncement ? 'Update Announcement' : 'Create Announcement'}</span>
                        </>
                      )}
                    </motion.button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={loading}
                      className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-secondary font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, announcement: null })}
        onConfirm={handleDelete}
        title="Delete Announcement"
        message={`Are you sure you want to delete "${deleteModal.announcement?.title}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}

