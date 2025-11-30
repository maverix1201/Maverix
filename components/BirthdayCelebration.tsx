'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Sparkles, PartyPopper } from 'lucide-react';
import UserAvatar from './UserAvatar';

interface BirthdayCelebrationProps {
  userName: string;
  userImage?: string;
  onClose: () => void;
}

export default function BirthdayCelebration({ userName, userImage, onClose }: BirthdayCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    // Hide confetti after animation completes
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Generate confetti particles
  const confetti = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 3,
    color: ['#FF6B9D', '#FFC93C', '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA'][
      Math.floor(Math.random() * 7)
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
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Confetti */}
        {showConfetti && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {confetti.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  left: `${particle.left}%`,
                  backgroundColor: particle.color,
                }}
                initial={{
                  top: -10,
                  rotate: 0,
                  scale: 1,
                }}
                animate={{
                  top: '100%',
                  rotate: 360,
                  scale: [1, 1.2, 0.8, 0],
                }}
                transition={{
                  duration: particle.duration,
                  delay: particle.delay,
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>
        )}

        {/* Celebration Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 50 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 rounded-2xl shadow-2xl p-8 md:p-12 max-w-md w-full mx-4 border-4 border-white/30"
        >
          {/* Sparkle decorations */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute top-4 right-4"
          >
            <Sparkles className="w-8 h-8 text-yellow-300" />
          </motion.div>
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            className="absolute bottom-4 left-4"
          >
            <Sparkles className="w-6 h-6 text-yellow-300" />
          </motion.div>

          {/* Content */}
          <div className="text-center relative z-10">
            {/* Gift Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
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
                  className="bg-yellow-400 p-4 rounded-full shadow-lg"
                >
                  <Gift className="w-12 h-12 text-yellow-900" />
                </motion.div>
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-yellow-400 rounded-full blur-xl"
                />
              </div>
            </motion.div>

            {/* Birthday Message */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-4xl md:text-5xl font-primary font-bold text-white mb-4"
            >
              🎉 Happy Birthday! 🎉
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="mb-6 flex justify-center"
            >
              <div className="relative">
                <UserAvatar
                  name={userName}
                  image={userImage}
                  size="xl"
                  className="ring-4 ring-white/50 shadow-2xl"
                />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="absolute -top-2 -right-2"
                >
                  <PartyPopper className="w-8 h-8 text-yellow-300" />
                </motion.div>
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-xl md:text-2xl font-primary font-semibold text-white mb-2"
            >
              {userName}
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-white/90 text-base md:text-lg font-secondary mb-8"
            >
              Wishing you a day filled with joy, laughter, and wonderful moments! 🎂✨
            </motion.p>

            {/* Close Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              onClick={onClose}
              className="bg-white text-pink-600 font-primary font-semibold px-8 py-3 rounded-full hover:bg-white/90 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Thank You! 🎊
            </motion.button>
          </div>

          {/* Floating balloons effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-4 h-6 rounded-full opacity-30"
                style={{
                  left: `${15 + i * 15}%`,
                  backgroundColor: ['#FF6B9D', '#FFC93C', '#4ECDC4', '#AA96DA'][i % 4],
                }}
                animate={{
                  y: [0, -20, 0],
                  x: [0, Math.sin(i) * 10, 0],
                }}
                transition={{
                  duration: 3 + i * 0.5,
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

