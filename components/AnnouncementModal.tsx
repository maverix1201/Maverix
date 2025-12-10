'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Calendar, X, Sparkles, BarChart3, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useSession } from 'next-auth/react';
import UserAvatar from './UserAvatar';
import { useToast } from '@/contexts/ToastContext';

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
  poll?: {
    question: string;
    options: Array<{
      text: string;
      votes: Array<{
        userId: string;
        votedAt: string;
      }>;
    }>;
    createdAt: string;
  };
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
  const { data: session } = useSession();
  const toast = useToast();
  const [localAnnouncement, setLocalAnnouncement] = useState<Announcement>(announcement);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    // Update local announcement when prop changes
    setLocalAnnouncement(announcement);
    
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
  }, [announcement._id, announcement, onViewTracked]);

  const handleVote = async (optionIndex: number) => {
    if (!session) return;
    setVoting(true);
    try {
      const res = await fetch(`/api/announcements/${announcement._id}/poll/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndex }),
      });
      const data = await res.json();
      if (res.ok) {
        setLocalAnnouncement(data.announcement);
        toast.success('Vote recorded!');
      } else {
        toast.error(data.error || 'Failed to vote');
      }
    } catch (err) {
      console.error('Error voting:', err);
      toast.error('Failed to vote');
    } finally {
      setVoting(false);
    }
  };

  const getUserVote = () => {
    if (!session || !localAnnouncement.poll) return null;
    const userId = (session.user as any)?.id;
    if (!userId) return null;
    
    for (let i = 0; i < localAnnouncement.poll.options.length; i++) {
      const option = localAnnouncement.poll.options[i];
      if (option.votes && option.votes.length > 0) {
        // Check if user has voted on this option
        // Handle both cases: userId as string or as object with _id
        const hasVoted = option.votes.some((v: any) => {
          if (!v.userId) return false;
          // If userId is an object (populated), check _id
          if (typeof v.userId === 'object' && v.userId !== null) {
            return v.userId._id?.toString() === userId || v.userId.toString() === userId;
          }
          // If userId is a string, compare directly
          return v.userId.toString() === userId;
        });
        
        if (hasVoted) {
          return i;
        }
      }
    }
    return null;
  };

  const getTotalVotes = () => {
    if (!localAnnouncement.poll) return 0;
    return localAnnouncement.poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
  };

  const getVotePercentage = (votes: number) => {
    const total = getTotalVotes();
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };

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
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
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
          className="relative bg-white/95 backdrop-blur-xl rounded-md shadow-2xl p-4 md:p-5 max-w-xl w-full mx-4 border border-white/50 overflow-hidden"
        >

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>

          {/* Content */}
          <div className="relative z-10">
            {/* Header with Creator Info */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-3 mb-3"
            >
              <UserAvatar
                name={announcement.createdBy.name}
                image={announcement.createdBy.profileImage}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-primary font-semibold text-gray-800 truncate">
                  {announcement.createdBy.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="capitalize font-secondary">{announcement.createdBy.role}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span className="font-secondary">{format(new Date(announcement.date), 'MMM dd, yyyy')}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl font-primary font-bold text-gray-900 mb-2"
            >
              {announcement.title}
            </motion.h1>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-3"
            >
              <p className="text-sm text-gray-700 font-secondary whitespace-pre-wrap leading-relaxed">
                {localAnnouncement.content}
              </p>
            </motion.div>

            {/* Poll Section */}
            {localAnnouncement.poll && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="border-t border-gray-200 pt-3 mt-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-primary font-semibold text-gray-800">Poll</h3>
                </div>
                <p className="text-sm font-primary font-medium text-gray-700 mb-3">
                  {localAnnouncement.poll.question}
                </p>
                <div className="space-y-2">
                  {localAnnouncement.poll.options.map((option, index) => {
                    const voteCount = option.votes?.length || 0;
                    const percentage = getVotePercentage(voteCount);
                    const userVotedIndex = getUserVote();
                    const userVoted = userVotedIndex === index;
                    const totalVotes = getTotalVotes();
                    const hasVoted = userVotedIndex !== null;

                    return (
                      <motion.button
                        key={index}
                        onClick={() => !voting && !hasVoted && handleVote(index)}
                        disabled={voting || hasVoted}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all relative overflow-hidden ${
                          userVoted
                            ? 'border-green-500 bg-green-50 shadow-sm ring-2 ring-green-200'
                            : hasVoted
                            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                            : 'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {userVoted && (
                              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                            )}
                            <span className={`text-sm font-secondary truncate ${
                              userVoted 
                                ? 'font-semibold text-green-700' 
                                : hasVoted
                                ? 'text-gray-600'
                                : 'text-gray-700'
                            }`}>
                              {option.text}
                            </span>
                          </div>
                          {hasVoted && (
                            <span className={`text-xs font-semibold ml-2 flex-shrink-0 ${
                              userVoted ? 'text-green-700' : 'text-gray-600'
                            }`}>
                              {percentage}%
                            </span>
                          )}
                        </div>
                        {hasVoted && (
                          <>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.5 }}
                                className={`h-full ${
                                  userVoted 
                                    ? 'bg-gradient-to-r from-green-500 to-green-600' 
                                    : 'bg-gradient-to-r from-blue-500 to-blue-600'
                                }`}
                              />
                            </div>
                            <p className={`text-xs mt-1.5 ${
                              userVoted ? 'text-green-600 font-medium' : 'text-gray-500'
                            }`}>
                              {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                            </p>
                          </>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
                {getTotalVotes() > 0 && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Total votes: {getTotalVotes()}
                  </p>
                )}
              </motion.div>
            )}

            {/* Close Button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={onClose}
              className="w-full bg-blue-600 text-white font-primary font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm mt-3"
            >
              Got it!
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

