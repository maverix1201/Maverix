'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Users, Clock, Calendar, DollarSign, Shield, Zap, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import Logo from './Logo';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Fixed Background with Image */}
      <div className="fixed inset-0 z-0" style={{ backgroundColor: '#cbecff', backgroundImage: 'var(--background-image)', backgroundSize: 'cover', backgroundPosition: '50% 90%', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed' }}>
      </div>

      {/* Scrollable Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="relative z-20 px-6 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Logo size="lg" />
            </motion.div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative z-10 px-6 py-2 md:py-15">
          <div className="max-w-7xl mx-auto">
            <div className="text-center">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-2xl md:text-6xl font-primary font-bold text-gray-900 mb-4 leading-tight"
              >
                Modern HR Management
                <br />
                <span className="text-5xl font-bold pt-2 md:text-6xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Made Simple
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-smd:text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed font-secondary"
              >
                Streamline your human resources operations with our intuitive platform.
                Manage employees, track attendance, handle leave requests, and more—all in one place.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex sm:flex-row gap-4 justify-center items-center"
              >
                <Link href="/login">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-3 bg-white text-primary rounded-lg font-semibold text-base border-2 border-primary hover:bg-primary-50 transition-all duration-300 shadow-lg"
                  >
                    Sign In
                  </motion.button>
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Footer 
        <footer className="mt-[150px] z-10 px-6 py-6 border-t border-gray-200 bg-white/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto text-center text-gray-600">
            <p className="text-sm font-secondary">&copy; 2024 MM HRM. All rights reserved.</p>
          </div>
        </footer>*/}
      </div>
    </div>
  );
}

