'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, CheckCircle, Trash2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: 'delete' | 'approve' | 'warning' | 'info';
  details?: React.ReactNode;
  loading?: boolean;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning',
  details,
  loading = false,
  confirmText,
  cancelText = 'Cancel',
}: ConfirmationModalProps) {
  const getTypeStyles = () => {
    switch (type) {
      case 'delete':
        return {
          iconBg: 'from-red-100 to-red-50',
          iconBorder: 'border-red-200/50',
          iconColor: 'text-red-600',
          iconBlur: 'bg-red-100',
          buttonGradient: 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
          buttonShadow: 'hover:shadow-red-500/30',
          icon: Trash2,
        };
      case 'approve':
        return {
          iconBg: 'from-green-100 to-green-50',
          iconBorder: 'border-green-200/50',
          iconColor: 'text-green-600',
          iconBlur: 'bg-green-100',
          buttonGradient: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
          buttonShadow: 'hover:shadow-green-500/30',
          icon: CheckCircle,
        };
      default:
        return {
          iconBg: 'from-amber-100 to-amber-50',
          iconBorder: 'border-amber-200/50',
          iconColor: 'text-amber-600',
          iconBlur: 'bg-amber-100',
          buttonGradient: 'from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700',
          buttonShadow: 'hover:shadow-amber-500/30',
          icon: AlertTriangle,
        };
    }
  };

  const styles = getTypeStyles();
  const Icon = styles.icon;
  const defaultConfirmText = type === 'delete' ? 'Delete' : type === 'approve' ? 'Approve' : 'Confirm';

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-white/80 backdrop-blur-xl rounded-md shadow-2xl border border-white/50">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 via-transparent to-gray-50/20 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent pointer-events-none" />
              
              <div className="relative">
                <div className="relative px-5 py-4 border-b border-gray-200/50">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className={`absolute inset-0 ${styles.iconBlur} blur-lg rounded-xl opacity-60`} />
                      <div className={`relative w-10 h-10 bg-gradient-to-br ${styles.iconBg} backdrop-blur-sm rounded-xl flex items-center justify-center border ${styles.iconBorder} shadow-sm`}>
                        <Icon className={`w-5 h-5 ${styles.iconColor}`} />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-bold text-gray-900 truncate">{title}</h2>
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{message}</p>
                    </div>
                    
                    <button
                      onClick={onClose}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 rounded-lg backdrop-blur-sm transition-all duration-200 disabled:opacity-50"
                      disabled={loading}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  {details && (
                    <div className="relative bg-gray-50/60 backdrop-blur-sm rounded-xl p-3.5 border border-gray-200/50 shadow-inner">
                      <div className="text-xs font-semibold text-gray-500 mb-2.5 uppercase tracking-wider">
                        Details
                      </div>
                      <div className="text-sm text-gray-700 space-y-2">{details}</div>
                    </div>
                  )}

                  {type === 'delete' && (
                    <div className="relative flex items-center gap-2.5 bg-amber-50/70 backdrop-blur-sm border border-amber-200/50 rounded-xl px-3 py-2.5 shadow-inner">
                      <div className="relative">
                        <div className="absolute inset-0 bg-amber-200/30 blur-sm rounded-full" />
                        <AlertTriangle className="relative w-4 h-4 text-amber-600" />
                      </div>
                      <p className="text-xs font-semibold text-amber-800">
                        This action cannot be undone
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={onClose}
                      disabled={loading}
                      className="flex-1 px-4 py-2.5 text-sm font-semibold bg-white/80 hover:bg-gray-50 active:bg-gray-100 backdrop-blur-sm border border-gray-300/50 rounded-xl text-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                    >
                      {cancelText}
                    </button>
                    <button
                      onClick={onConfirm}
                      disabled={loading}
                      className={`relative flex-1 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r ${styles.buttonGradient} text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg ${styles.buttonShadow} overflow-hidden group`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      
                      {loading ? (
                        <>
                          <div className="relative w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span className="relative">Processing...</span>
                        </>
                      ) : (
                        <>
                          <Icon className="relative w-4 h-4" />
                          <span className="relative">{confirmText || defaultConfirmText}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
