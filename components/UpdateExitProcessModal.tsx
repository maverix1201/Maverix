'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Calendar, MessageSquare, Building2, Users, Wallet, Download, Lock, FileCheck, Upload } from 'lucide-react';
import LoadingDots from './LoadingDots';

interface UpdateExitProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => Promise<void>;
  step: string;
  stepTitle: string;
  resignation: any;
  loading?: boolean;
}

const stepIcons: Record<string, any> = {
  noticePeriod: Calendar,
  knowledgeTransfer: MessageSquare,
  assetReturn: Building2,
  clearances: Users,
  exitInterview: MessageSquare,
  fnf: Wallet,
  documents: Download,
  systemAccess: Lock,
  exitClosure: FileCheck,
};

export default function UpdateExitProcessModal({
  isOpen,
  onClose,
  onConfirm,
  step,
  stepTitle,
  resignation,
  loading = false,
}: UpdateExitProcessModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [files, setFiles] = useState<{ experienceLetter?: File; relievingLetter?: File }>({});
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!isOpen) {
      setFormData({});
      setFiles({});
      setUploadingFiles({});
    } else {
      // Initialize form data based on step
      if (step === 'clearances') {
        setFormData({ department: '', status: 'approved', notes: '' });
      } else if (step === 'fnf') {
        setFormData({ status: 'processing', amount: '', notes: '', date: '' });
      } else if (step === 'documents') {
        setFormData({});
      } else {
        setFormData({ completed: true, date: '', notes: '' });
      }
    }
  }, [isOpen, step]);

  const handleFileChange = (type: 'experienceLetter' | 'relievingLetter', file: File | null) => {
    if (file) {
      setFiles(prev => ({ ...prev, [type]: file }));
    } else {
      setFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[type];
        return newFiles;
      });
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    // Compress and upload file (similar to profile upload)
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/profile/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'File upload failed');
    }

    const data = await response.json();
    return data.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let submitData: any = { ...formData };

      // Handle file uploads for documents
      if (step === 'documents') {
        const uploadedFiles: any = {};
        
        if (files.experienceLetter) {
          setUploadingFiles(prev => ({ ...prev, experienceLetter: true }));
          uploadedFiles.experienceLetter = await uploadFile(files.experienceLetter);
          setUploadingFiles(prev => ({ ...prev, experienceLetter: false }));
        }
        
        if (files.relievingLetter) {
          setUploadingFiles(prev => ({ ...prev, relievingLetter: true }));
          uploadedFiles.relievingLetter = await uploadFile(files.relievingLetter);
          setUploadingFiles(prev => ({ ...prev, relievingLetter: false }));
        }

        if (Object.keys(uploadedFiles).length > 0) {
          submitData.files = uploadedFiles;
        }
      }

      await onConfirm(submitData);
    } catch (error: any) {
      console.error('Error submitting:', error);
      alert(error.message || 'Failed to update exit process');
    }
  };

  const StepIcon = stepIcons[step] || FileCheck;
  const isUploading = Object.values(uploadingFiles).some(v => v);

  if (!isOpen) return null;

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
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <StepIcon className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">{stepTitle}</h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={loading || isUploading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {step === 'noticePeriod' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Mark Notice Period as Complied
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.completed || false}
                        onChange={(e) => setFormData({ ...formData, completed: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                        disabled={loading || isUploading}
                      />
                      <span className="text-sm text-gray-600">Notice period has been complied with</span>
                    </div>
                  </div>
                  {formData.completed && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Compliance Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={formData.date || ''}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        disabled={loading || isUploading}
                      />
                    </div>
                  )}
                </>
              )}

              {step === 'knowledgeTransfer' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Mark Knowledge Transfer as Completed
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.completed || false}
                        onChange={(e) => setFormData({ ...formData, completed: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                        disabled={loading || isUploading}
                      />
                      <span className="text-sm text-gray-600">Knowledge transfer has been completed</span>
                    </div>
                  </div>
                  {formData.completed && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Completion Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={formData.date || ''}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        disabled={loading || isUploading}
                      />
                    </div>
                  )}
                </>
              )}

              {step === 'assetReturn' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Mark Assets as Returned
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.completed || false}
                        onChange={(e) => setFormData({ ...formData, completed: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                        disabled={loading || isUploading}
                      />
                      <span className="text-sm text-gray-600">All company assets have been returned</span>
                    </div>
                  </div>
                  {formData.completed && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Return Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={formData.date || ''}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={loading || isUploading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Notes (Optional)
                        </label>
                        <textarea
                          value={formData.notes || ''}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                          placeholder="Add any notes about asset return..."
                          disabled={loading || isUploading}
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {step === 'clearances' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.department || ''}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={loading || isUploading}
                    >
                      <option value="">Select Department</option>
                      <option value="design">Design Department</option>
                      <option value="operation">Operation Department</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.status || 'approved'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={loading || isUploading}
                    >
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Add any notes about this clearance..."
                      disabled={loading || isUploading}
                    />
                  </div>
                </>
              )}

              {step === 'exitInterview' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Mark Exit Interview as Completed
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.completed || false}
                        onChange={(e) => setFormData({ ...formData, completed: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                        disabled={loading || isUploading}
                      />
                      <span className="text-sm text-gray-600">Exit interview has been completed</span>
                    </div>
                  </div>
                  {formData.completed && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Interview Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={formData.date || ''}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={loading || isUploading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Feedback (Optional)
                        </label>
                        <textarea
                          value={formData.notes || ''}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                          placeholder="Enter exit interview feedback..."
                          disabled={loading || isUploading}
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {step === 'fnf' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      FnF Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.status || 'processing'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={loading || isUploading}
                    >
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  {formData.status === 'completed' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Processed Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={formData.date || ''}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={loading || isUploading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          FnF Amount (Optional)
                        </label>
                        <input
                          type="number"
                          value={formData.amount || ''}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter amount in ₹"
                          disabled={loading || isUploading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Notes (Optional)
                        </label>
                        <textarea
                          value={formData.notes || ''}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                          placeholder="Add any notes about FnF settlement..."
                          disabled={loading || isUploading}
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {step === 'documents' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Experience Letter
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,image/*"
                      onChange={(e) => handleFileChange('experienceLetter', e.target.files?.[0] || null)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={loading || isUploading}
                    />
                    {uploadingFiles.experienceLetter && (
                      <p className="text-xs text-blue-600 mt-1">Uploading...</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Relieving Letter
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,image/*"
                      onChange={(e) => handleFileChange('relievingLetter', e.target.files?.[0] || null)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={loading || isUploading}
                    />
                    {uploadingFiles.relievingLetter && (
                      <p className="text-xs text-blue-600 mt-1">Uploading...</p>
                    )}
                  </div>
                </>
              )}

              {step === 'systemAccess' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Mark System Access as Deactivated
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.completed || false}
                        onChange={(e) => setFormData({ ...formData, completed: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                        disabled={loading || isUploading}
                      />
                      <span className="text-sm text-gray-600">System access has been deactivated</span>
                    </div>
                  </div>
                  {formData.completed && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Deactivation Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={formData.date || ''}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        disabled={loading || isUploading}
                      />
                    </div>
                  )}
                </>
              )}

              {step === 'exitClosure' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Mark Exit as Closed
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.completed || false}
                        onChange={(e) => setFormData({ ...formData, completed: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                        disabled={loading || isUploading}
                      />
                      <span className="text-sm text-gray-600">Exit process has been formally closed</span>
                    </div>
                  </div>
                  {formData.completed && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Closure Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={formData.date || ''}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        disabled={loading || isUploading}
                      />
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading || isUploading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || isUploading || (step === 'clearances' && !formData.department)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading || isUploading ? (
                    <>
                      <LoadingDots size="sm" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Update</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
