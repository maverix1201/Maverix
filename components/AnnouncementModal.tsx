'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Calendar, X, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import UserAvatar from './UserAvatar';

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
}

interface AnnouncementModalProps {
  announcement: Announcement;
  onClose: () => void;
  onViewTracked: () => void;
}

export default function AnnouncementModal({
  announcement,
  onClose,
  onViewTracked,
}: AnnouncementModalProps) {
  useEffect(() => {
    // Track view when modal opens
    const trackView = async () => {
      try {
        await fetch(`/api/announcements/${announcement._id}/view`, {
          method: 'POST',
        });
        onViewTracked();
      } catch (err) {
        console.error('Error tracking view:', err);
      }
    };

    trackView();
  }, [announcement._id, onViewTracked]);

  // Generate floating particles
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 3 + Math.random() * 2,
    size: 4 + Math.random() * 4,
    color: ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'][
      Math.floor(Math.random() * 5)
    ],
  }));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-purple-900/80 to-pink-900/80 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Floating Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                left: `${particle.left}%`,
                backgroundColor: particle.color,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
              }}
              initial={{
                top: '100%',
                opacity: 0,
                scale: 0,
              }}
              animate={{
                top: '-10%',
                opacity: [0, 1, 1, 0],
                scale: [0, 1, 1, 0],
                x: [0, Math.sin(particle.id) * 50, Math.cos(particle.id) * 30, 0],
              }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                ease: 'easeOut',
                repeat: Infinity,
                repeatDelay: 2,
              }}
            />
          ))}
        </div>

        {/* Announcement Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative bg-gradient-to-br from-white via-blue-50 to-purple-50 rounded-3xl shadow-2xl p-8 md:p-12 max-w-3xl w-full mx-4 border-4 border-white/50 overflow-hidden"
        >
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-32 h-32 border-2 border-blue-500 rounded-full"
                style={{
                  left: `${(i % 5) * 25}%`,
                  top: `${Math.floor(i / 5) * 25}%`,
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  rotate: [0, 180, 360],
                }}
                transition={{
                  duration: 10 + i * 0.5,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            ))}
          </div>

          {/* Sparkle decorations */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute top-6 right-6"
          >
            <Sparkles className="w-8 h-8 text-blue-400" />
          </motion.div>
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            className="absolute bottom-6 left-6"
          >
            <Sparkles className="w-6 h-6 text-purple-400" />
          </motion.div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 z-20 p-2 hover:bg-white/50 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>

          {/* Content */}
          <div className="relative z-10">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mb-6 flex justify-center"
            >
              <div className="relative">
                <motion.div
                  animate={{
                    rotate: [0, -10, 10, -10, 0],
                    scale: [1, 1.1, 1, 1.1, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 1,
                  }}
                  className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-full shadow-2xl"
                >
                  <Megaphone className="w-12 h-12 text-white" />
                </motion.div>
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full blur-2xl"
                />
              </div>
            </motion.div>

            {/* Creator Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-3 mb-6"
            >
              <UserAvatar
                name={announcement.createdBy.name}
                image={announcement.createdBy.profileImage}
                size="lg"
                className="ring-4 ring-blue-200 shadow-lg"
              />
              <div className="text-center">
                <p className="text-lg font-primary font-bold text-gray-800">
                  {announcement.createdBy.name}
                </p>
                <p className="text-sm text-gray-600 font-secondary capitalize">
                  {announcement.createdBy.role}
                </p>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-3xl md:text-4xl font-primary font-bold text-gray-800 mb-4 text-center"
            >
              {announcement.title}
            </motion.h1>

            {/* Date */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex items-center justify-center gap-2 mb-6 text-gray-600"
            >
              <Calendar className="w-5 h-5" />
              <span className="font-secondary">
                {format(new Date(announcement.date), 'MMMM dd, yyyy')}
              </span>
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 md:p-8 mb-8 border border-white/50 shadow-lg"
            >
              <p className="text-base md:text-lg text-gray-700 font-secondary whitespace-pre-wrap leading-relaxed">
                {announcement.content}
              </p>
            </motion.div>

            {/* Close Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              onClick={onClose}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-primary font-semibold px-8 py-4 rounded-xl hover:shadow-2xl transition-all transform hover:scale-105 active:scale-95"
            >
              Got it!
            </motion.button>
          </div>

          {/* Decorative Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-3xl">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-blue-400 opacity-30"
                style={{
                  left: `${10 + (i % 4) * 25}%`,
                  top: `${10 + Math.floor(i / 4) * 30}%`,
                }}
                animate={{
                  y: [0, -30, 0],
                  x: [0, Math.sin(i) * 20, 0],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 4 + i * 0.5,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

