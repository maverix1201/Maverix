'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import LoadingDots from './LoadingDots';

interface RejectResignationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  rejecting: boolean;
}

export default function RejectResignationModal({
  isOpen,
  onClose,
  onConfirm,
  rejecting,
}: RejectResignationModalProps) {
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setRejectionReason('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rejectionReason.trim()) {
      onConfirm(rejectionReason);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 font-primary">Reject Resignation</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            disabled={rejecting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 font-secondary">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              placeholder="Please provide a reason for rejecting this resignation..."
              required
              disabled={rejecting}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!rejectionReason.trim() || rejecting}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rejecting ? <LoadingDots size="sm" /> : 'Reject Resignation'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={rejecting}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
