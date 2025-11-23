'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface RejectLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  message: string;
  details?: React.ReactNode;
  loading?: boolean;
  isApprovedLeave?: boolean;
}

export default function RejectLeaveModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  details,
  loading = false,
  isApprovedLeave = false,
}: RejectLeaveModalProps) {
  const [rejectionReason, setRejectionReason] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!rejectionReason.trim()) {
      return;
    }
    onConfirm(rejectionReason.trim());
    setRejectionReason('');
  };

  const handleClose = () => {
    setRejectionReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white/90 backdrop-blur-sm rounded-xl shadow-xl w-full max-w-md"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-primary font-bold text-gray-800 mb-1">{title}</h2>
              <p className="text-sm text-gray-600 font-secondary">{message}</p>
            </div>
            <button
              onClick={handleClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              disabled={loading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Details Section */}
          {details && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-2 font-secondary">Leave Details:</div>
              <div className="text-sm text-gray-600 font-secondary">{details}</div>
            </div>
          )}

          {/* Info about balance restoration */}
          {isApprovedLeave && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-secondary">
                <strong>Note:</strong> Rejecting this approved leave will restore the leave days back to the employee&apos;s balance.
              </p>
            </div>
          )}

          {/* Rejection Reason Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2 font-secondary">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter the reason for rejection..."
              className="w-full px-3 py-2 text-sm text-gray-700 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none font-secondary bg-white resize-none min-h-[100px]"
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-secondary font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !rejectionReason.trim()}
              className="flex-1 px-4 py-2.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-secondary font-semibold"
            >
              {loading ? 'Rejecting...' : 'Reject Leave'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

