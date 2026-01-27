'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Laptop,
  Smartphone,
  CreditCard,
  Headphones,
  Monitor,
  Mouse,
  Check,
  Upload,
  Download,
  Building2,
  Users,
  Computer,
  Wallet,
  MessageSquare,
  FileCheck,
  Lock,
  X,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import LoadingDots from './LoadingDots';

interface ResignationFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const companyAssets = [
  { id: 'laptop', label: 'Laptop', icon: Laptop },
  { id: 'mobile', label: 'Mobile Phone', icon: Smartphone },
  { id: 'id-card', label: 'ID Card', icon: CreditCard },
  { id: 'access-card', label: 'Access Card', icon: CreditCard },
  { id: 'headphones', label: 'Headphones', icon: Headphones },
  { id: 'monitor', label: 'Monitor', icon: Monitor },
  { id: 'mouse-keyboard', label: 'Mouse/Keyboard', icon: Mouse },
];

const steps = [
  { id: 1, title: 'Resignation Details', icon: FileText },
  { id: 2, title: 'Notice Period', icon: Calendar },
  { id: 3, title: 'Knowledge Transfer', icon: MessageSquare },
  { id: 4, title: 'Company Assets', icon: Building2 },
  { id: 5, title: 'Department Clearances', icon: Users },
];

export default function ResignationForm({ onClose, onSuccess }: ResignationFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const [formData, setFormData] = useState({
    // Step 1: Resignation Details
    resignationDate: '',
    reason: '',
    feedback: '',

    // Step 2: Notice Period
    noticePeriodStartDate: '',
    noticePeriodEndDate: '',

    // Step 3: Knowledge Transfer
    handoverNotes: '',

    // Step 4: Company Assets
    assets: [] as string[],

    // Step 5: Department Clearances
    clearancesAcknowledged: false,
  });

  const handleNext = () => {
    if (currentStep < steps.length) {
      // Validate current step
      if (currentStep === 1) {
        if (!formData.resignationDate || !formData.reason.trim()) {
          toast.error('Please fill in all required fields');
          return;
        }
      }
      if (currentStep === 2) {
        if (!formData.noticePeriodStartDate || !formData.noticePeriodEndDate) {
          toast.error('Please fill in notice period dates');
          return;
        }
      }
      if (currentStep === 5) {
        if (!formData.clearancesAcknowledged) {
          toast.error('Please acknowledge the Department Clearances requirement');
          return;
        }
      }

      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!formData.resignationDate || !formData.reason.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (!formData.clearancesAcknowledged) {
      toast.error('Please acknowledge the Department Clearances requirement');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        resignationDate: formData.resignationDate,
        reason: formData.reason,
        feedback: formData.feedback || '',
        noticePeriodStartDate: formData.noticePeriodStartDate || null,
        noticePeriodEndDate: formData.noticePeriodEndDate || null,
        handoverNotes: formData.handoverNotes || '',
        assets: Array.isArray(formData.assets) ? formData.assets.filter((a: string) => a != null && a !== '' && a.trim() !== '') : [],
        clearancesAcknowledged: formData.clearancesAcknowledged,
      };
      
      const res = await fetch('/api/resignation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Resignation submitted successfully');
        onSuccess();
        onClose();
      } else {
        toast.error(data.error || 'Failed to submit resignation');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAsset = (assetId: string) => {
    setFormData((prev) => ({
      ...prev,
      assets: prev.assets.includes(assetId)
        ? prev.assets.filter((a) => a !== assetId)
        : [...prev.assets, assetId],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-purple-600 text-white p-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold font-primary">Submit Resignation</h2>
            <p className="text-xs text-white/90 mt-0.5">Complete all steps to submit your resignation</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-primary text-white shadow-md scale-105'
                          : isCompleted
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <StepIcon className="w-4 h-4" />
                      )}
                    </div>
                    <span
                      className={`text-[10px] mt-1 font-medium ${
                        isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-gray-500'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1.5 rounded ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {/* Step 1: Resignation Details */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Resignation Date (Last Working Day) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.resignationDate}
                    onChange={(e) => setFormData({ ...formData, resignationDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">Your last working day</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Reason for Resignation <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    placeholder="Please provide a detailed reason for your resignation..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Additional Feedback (Optional)
                  </label>
                  <textarea
                    value={formData.feedback}
                    onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    placeholder="Any additional comments or feedback..."
                  />
                </div>
              </motion.div>
            )}

            {/* Step 2: Notice Period */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-2">
                  <h3 className="text-xs font-semibold text-blue-900 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Notice Period Compliance
                  </h3>
                  <p className="text-[10px] text-blue-800">
                    Please provide your notice period start and end dates. The notice period must comply with company policy.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Notice Period Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.noticePeriodStartDate}
                    onChange={(e) => setFormData({ ...formData, noticePeriodStartDate: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Notice Period End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.noticePeriodEndDate}
                    onChange={(e) => setFormData({ ...formData, noticePeriodEndDate: e.target.value })}
                    min={formData.noticePeriodStartDate}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    This should match your last working day (Resignation Date)
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 3: Knowledge Transfer */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 mb-2">
                  <h3 className="text-xs font-semibold text-green-900 mb-1 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Knowledge Transfer & Handover
                  </h3>
                  <p className="text-[10px] text-green-800">
                    Please provide details about knowledge transfer and handover of your responsibilities.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Handover Notes
                  </label>
                  <textarea
                    value={formData.handoverNotes}
                    onChange={(e) => setFormData({ ...formData, handoverNotes: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    placeholder="Please provide details about:
- Key responsibilities and ongoing projects
- Important documents and their locations
- Contacts and stakeholders
- Any pending tasks or deadlines
- Access credentials (if applicable)
- Any other relevant information for smooth transition..."
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Detailed handover notes help ensure a smooth transition
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 4: Company Assets */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 mb-2">
                  <h3 className="text-xs font-semibold text-orange-900 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Company Asset Return
                  </h3>
                  <p className="text-[10px] text-orange-800">
                    Select all company assets currently in your possession. These assets must be returned before your last working day.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {companyAssets.map((asset) => {
                    const Icon = asset.icon;
                    const isSelected = formData.assets.includes(asset.id);
                    return (
                      <label
                        key={asset.id}
                        className={`relative flex items-center gap-1.5 p-2 border-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleAsset(asset.id)}
                          className="sr-only"
                        />
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            isSelected
                              ? 'border-primary bg-primary'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-gray-500'}`} />
                        <span className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-gray-700'}`}>
                          {asset.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 5: Department Clearances */}
            {currentStep === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-2">
                  <h3 className="text-xs font-semibold text-blue-900 mb-1 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Department Clearances
                  </h3>
                  <p className="text-[10px] text-blue-800">
                    Clearance from all concerned departments is mandatory. This includes reporting manager, IT, Admin/Facilities, and Finance. Exit clearance status will be updated by each department directly in the HRIS portal.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-gray-800 mb-2">Required Clearances:</h4>
                    <ul className="space-y-2 text-xs text-gray-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        <span>Reporting Manager</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        <span>IT Department</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        <span>Admin/Facilities</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        <span>Finance Department</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.clearancesAcknowledged}
                        onChange={(e) => setFormData({ ...formData, clearancesAcknowledged: e.target.checked })}
                        className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                        required
                      />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-800">
                          I acknowledge that clearance from all departments is mandatory <span className="text-red-500">*</span>
                        </p>
                        <p className="text-[10px] text-gray-600 mt-1">
                          I understand that my exit process cannot be completed without clearance from Reporting Manager, IT, Admin/Facilities, and Finance departments.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-3 bg-gray-50 flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>

          <div className="text-xs text-gray-600">
            Step {currentStep} of {steps.length}
          </div>

          {currentStep < steps.length ? (
            <button
              onClick={handleNext}
              className="px-4 py-1.5 text-sm bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 transition-all shadow-md font-semibold flex items-center gap-1.5"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-1.5 text-sm bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-md font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <LoadingDots size="sm" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Submit Resignation
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
