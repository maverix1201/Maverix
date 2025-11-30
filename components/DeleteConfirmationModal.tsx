'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  details?: React.ReactNode;
  itemName?: string;
  loading?: boolean;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  details,
  itemName,
  loading = false,
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white/70 backdrop-blur-sm rounded-lg shadow-xl w-full max-w-md"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 w-12 h-12 bg-red-200/70 backdrop-blur-sm rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-primary font-bold text-gray-800 mb-1">{title}</h2>
              <p className="text-sm text-gray-600 font-secondary">{message}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              disabled={loading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Details Section */}
          {details && (
            <div className="mb-4 p-3 bg-gray-100/30 rounded-lg border border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-2 font-secondary">Details:</div>
              <div className="text-sm text-gray-600 font-secondary">{details}</div>
            </div>
          )}

          {/* Item Name */}
          {itemName && (
            <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="text-sm font-medium text-red-800 font-secondary">
                <span className="font-semibold">{itemName}</span>
              </div>
            </div>
          )}

          {/* Warning Message */}
          <div className="mb-6 p-2 bg-yellow-200/30 rounded-lg">
            <p className="text-sm text-yellow-700 font-bold text-center">
              This action cannot be undone.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-secondary"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-secondary"
            >
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}


