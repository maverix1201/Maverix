'use client';

import { motion } from 'framer-motion';
import { Sparkles, Globe, Search, ArrowRight, Users, Clock, Calendar, Shield, Zap, TrendingUp, LogInIcon } from 'lucide-react';
import Link from 'next/link';
import Logo from './Logo';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black flex flex-col">
      {/* Animated Background Gradient */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-pink-900/20"></div>
        {/* Animated Glowing Orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/30 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {/* Abstract Grid Pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}></div>
      </div>

      {/* Scrollable Content */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Navigation */}
        <nav className="relative z-20 px-6 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Logo size="md" className='brightness-0 invert mx-auto' />
            </motion.div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative z-10 px-2 py-20 md:py-10 flex-grow flex">
          <div className="max-w-7xl mx-auto w-full">
            <div className="text-center relative">
              {/* Abstract Glowing Graphic Behind Text */}
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] md:w-[800px] md:h-[800px] opacity-20"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.2 }}
                transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 blur-3xl"></div>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 blur-3xl animate-spin" style={{ animationDuration: '20s' }}></div>
              </motion.div>

              {/* Main Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-4xl md:text-7xl lg:text-7xl font-bold mb-6 leading-tight relative z-10"
              >
                <span className="bg-gradient-to-r from-pink-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">Smart HR Management</span> <br />
                <span className="text-white">for Modern Teams</span>
              </motion.h1>

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-sm md:text-xl text-white/80 mb-12 relative z-10"
              >
                Manage attendance, leaves, payroll, and employee workflows—all in one powerful platform.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-4 justify-center items-center relative z-10"
              >
                <Link href="/login">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 md:px-8 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold text-white text-sm md:text-lg flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                  >
                    Get Started
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 px-6 py-8 mt-auto">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-white/60 text-[10px] md:text-sm">
              &copy; 2025 MaveriX. All rights reserved. Made with ❤️ by <span className="text-pink-400">Chandu</span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

