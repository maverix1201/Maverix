'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import LoadingDots from '@/components/LoadingDots';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Calendar,
  TrendingUp,
  Wallet,
  FileText,
  CreditCard,
  Building2,
  Save,
  X,
  Eye,
  EyeOff,
  Lock,
  Upload,
  Image as ImageIcon,
  XCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
} from 'lucide-react';
import { format } from 'date-fns';
import UserAvatar from '@/components/UserAvatar';
import { useToast } from '@/contexts/ToastContext';
import { compressImage, blobToFile, getFileSizeKB } from '@/utils/imageCompression';

interface Finance {
  _id: string;
  month: number;
  year: number;
  baseSalary: number;
  totalSalary: number;
  createdAt: string;
  panCardImage?: string;
  aadharCardImage?: string;
}

interface User {
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  location?: string;
  panNumber?: string;
  aadharNumber?: string;
}

export default function EmployeeFinancePage() {
  const { data: session } = useSession();
  const [finances, setFinances] = useState<Finance[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    location: '',
    panNumber: '',
    aadharNumber: '',
  });
  const [showSalary, setShowSalary] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState<{ [key: string]: boolean }>({});
  const [docPreview, setDocPreview] = useState<{ [key: string]: { pan?: string; aadhar?: string } }>({});
  const [userDocuments, setUserDocuments] = useState<{ panCardImage?: string; aadharCardImage?: string }>({});
  const [documentsExpanded, setDocumentsExpanded] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetchFinances();
    fetchUserProfile();
    fetchUserDocuments();
  }, []);

  // Refetch documents when page becomes visible (handles page refresh)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUserDocuments();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchUserDocuments = async () => {
    try {
      const res = await fetch('/api/profile/documents', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json();
      
      if (res.ok) {
        // Handle null values properly - convert null/empty to undefined, but keep actual URLs
        const panCard = data.panCardImage && typeof data.panCardImage === 'string' && data.panCardImage.trim() !== '' && data.panCardImage !== 'null'
          ? data.panCardImage 
          : undefined;
        const aadharCard = data.aadharCardImage && typeof data.aadharCardImage === 'string' && data.aadharCardImage.trim() !== '' && data.aadharCardImage !== 'null'
          ? data.aadharCardImage 
          : undefined;
        
        setUserDocuments({
          panCardImage: panCard,
          aadharCardImage: aadharCard,
        });
      } else {
        console.error('Failed to fetch documents:', data.error);
      }
    } catch (err) {
      console.error('Error fetching user documents:', err);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        setBankFormData({
          bankName: data.user.bankName || '',
          accountNumber: data.user.accountNumber || '',
          ifscCode: data.user.ifscCode || '',
          location: data.user.location || '',
          panNumber: data.user.panNumber || '',
          aadharNumber: data.user.aadharNumber || '',
        });
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const fetchFinances = async () => {
    try {
      const res = await fetch('/api/finance');
      const data = await res.json();
      setFinances(data.finances || []);
    } catch (err) {
      console.error('Error fetching finances:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month: number) => {
    return format(new Date(2000, month - 1, 1), 'MMMM');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankLoading(true);

    try {
      const requestBody = {
        bankName: bankFormData.bankName,
        accountNumber: bankFormData.accountNumber,
        ifscCode: bankFormData.ifscCode,
        location: bankFormData.location,
        panNumber: bankFormData.panNumber,
        aadharNumber: bankFormData.aadharNumber,
      };
      
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save bank details');
        setBankLoading(false);
        return;
      }

      toast.success('Bank details saved successfully');
      // Update user state with the response data
      if (data.user) {
        // Update user state - ensure all fields are included (preserve null values)
        const updatedUser = {
          ...data.user,
          location: data.user.location !== undefined ? data.user.location : null,
          panNumber: data.user.panNumber !== undefined ? data.user.panNumber : null,
          aadharNumber: data.user.aadharNumber !== undefined ? data.user.aadharNumber : null,
        };
        setUser(updatedUser);
        // Also update form data to reflect saved values
        setBankFormData({
          bankName: data.user.bankName || '',
          accountNumber: data.user.accountNumber || '',
          ifscCode: data.user.ifscCode || '',
          location: data.user.location || '',
          panNumber: data.user.panNumber || '',
          aadharNumber: data.user.aadharNumber || '',
        });
      }
      setShowBankForm(false);
      setBankLoading(false);
      
      // Force a re-fetch after a short delay to ensure we have the latest data from DB
      setTimeout(async () => {
        await fetchUserProfile();
      }, 500);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
      setBankLoading(false);
    }
  };

  const handleShowSalaryClick = () => {
    if (showSalary) {
      // If already showing, just hide it
      setShowSalary(false);
    } else {
      // If hidden, show password modal
      setShowPasswordModal(true);
      setPassword('');
      setPasswordError('');
    }
  };

  const handlePasswordVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setVerifyingPassword(true);

    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordError(data.error || 'Incorrect password');
        setVerifyingPassword(false);
        return;
      }

      // Password verified successfully
      setShowPasswordModal(false);
      setShowSalary(true);
      setPassword('');
      setPasswordError('');
      setVerifyingPassword(false);
      toast.success('Password verified successfully');
    } catch (err: any) {
      setPasswordError(err.message || 'An error occurred');
      setVerifyingPassword(false);
    }
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setPassword('');
    setPasswordError('');
    setVerifyingPassword(false);
  };

  const handleDocumentUpload = async (documentType: 'pan' | 'aadhar', file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    try {
      setUploadingDocs(prev => ({ ...prev, [`general-${documentType}`]: true }));

      // Compress image to max 100KB
      const originalSizeKB = getFileSizeKB(file);
      const compressedBlob = await compressImage(file, 100, 1200, 1200);
      const compressedFile = blobToFile(compressedBlob, file.name, 'image/jpeg');
      const compressedSizeKB = getFileSizeKB(compressedFile);
      
      // Verify compression was successful (should be <= 100KB)
      if (compressedSizeKB > 100) {
        console.warn(`Warning: Compressed size (${compressedSizeKB.toFixed(2)}KB) exceeds target of 100KB`);
      }

      // Upload compressed file
      const uploadFormData = new FormData();
      uploadFormData.append('file', compressedFile, file.name);

      const uploadRes = await fetch('/api/profile/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        toast.error(uploadData.error || 'Failed to upload document');
        setUploadingDocs(prev => ({ ...prev, [`general-${documentType}`]: false }));
        return;
      }

      // Update user profile with document URL (stored at user level, not finance level)
      const updateRes = await fetch('/api/profile/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [documentType === 'pan' ? 'panCardImage' : 'aadharCardImage']: uploadData.url,
        }),
      });

      const updateData = await updateRes.json();

      if (!updateRes.ok) {
        toast.error(updateData.error || 'Failed to save document');
        setUploadingDocs(prev => ({ ...prev, [`general-${documentType}`]: false }));
        // Clear preview on error
        setDocPreview(prev => {
          const newPreview = { ...prev };
          if (newPreview['general']) {
            newPreview['general'] = { ...newPreview['general'], [documentType]: undefined };
          }
          return newPreview;
        });
        return;
      }

      // Update state immediately with the uploaded URL from server response
      if (updateData.panCardImage || updateData.aadharCardImage) {
        setUserDocuments(prev => ({
          ...prev,
          panCardImage: updateData.panCardImage || prev.panCardImage,
          aadharCardImage: updateData.aadharCardImage || prev.aadharCardImage,
        }));
      } else {
        // Fallback: use the uploaded URL if server response doesn't include it
        setUserDocuments(prev => ({
          ...prev,
          [documentType === 'pan' ? 'panCardImage' : 'aadharCardImage']: uploadData.url,
        }));
      }

      toast.success(`${documentType === 'pan' ? 'PAN' : 'Aadhar'} card uploaded successfully`);
      
      // Clear preview after state is updated (preview is no longer needed since we have the real URL)
      setDocPreview(prev => {
        const newPreview = { ...prev };
        if (newPreview['general']) {
          newPreview['general'] = { ...newPreview['general'], [documentType]: undefined };
        }
        return newPreview;
      });
      
      setUploadingDocs(prev => ({ ...prev, [`general-${documentType}`]: false }));
      
      // Refresh documents from server to ensure consistency (optional, since we already updated state)
      // await fetchUserDocuments();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
      setUploadingDocs(prev => ({ ...prev, [`general-${documentType}`]: false }));
      // Clear preview on error
      setDocPreview(prev => {
        const newPreview = { ...prev };
        if (newPreview['general']) {
          newPreview['general'] = { ...newPreview['general'], [documentType]: undefined };
        }
        return newPreview;
      });
    }
  };

  const handleDocumentChange = (documentType: 'pan' | 'aadhar', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setDocPreview({ ...docPreview, general: { ...docPreview['general'], [documentType]: reader.result as string } });
    };
    reader.readAsDataURL(file);

    // Upload document
    handleDocumentUpload(documentType, file);
  };

  const handleRemoveDocument = async (documentType: 'pan' | 'aadhar') => {
    try {
      const updateRes = await fetch('/api/profile/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [documentType === 'pan' ? 'panCardImage' : 'aadharCardImage']: null,
        }),
      });

      const updateData = await updateRes.json();

      if (!updateRes.ok) {
        toast.error(updateData.error || 'Failed to remove document');
        return;
      }

      toast.success(`${documentType === 'pan' ? 'PAN' : 'Aadhar'} card removed successfully`);
      
      // Update state immediately
      setUserDocuments(prev => ({
        ...prev,
        [documentType === 'pan' ? 'panCardImage' : 'aadharCardImage']: undefined,
      }));

      // Clear preview
      setDocPreview(prev => {
        const newPreview = { ...prev };
        if (newPreview['general']) {
          newPreview['general'] = { ...newPreview['general'], [documentType]: undefined };
        }
        return newPreview;
      });
      
      // Refresh documents from server to ensure consistency
      await fetchUserDocuments();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    }
  };

  // Calculate stats
  const baseSalary = finances.length > 0 ? finances[0].baseSalary : 0;
  const totalAnnualSalary = baseSalary * 12;

  return (
    <DashboardLayout role="employee">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="space-y-4 p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-xl shadow-lg">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-primary font-bold text-gray-800">My Salary</h1>
                <p className="text-xs text-gray-600 mt-0.5 font-secondary">
                  View your salary information and payslips
                </p>
              </div>
            </div>
            <button
              onClick={handleShowSalaryClick}
              className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-lg border border-white/50 hover:shadow-lg transition-all font-secondary text-sm font-medium text-gray-700"
              title={showSalary ? 'Hide salary' : 'Show salary'}
            >
              {showSalary ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  <span>Hide</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span>Show</span>
                </>
              )}
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-gray-600 font-secondary mb-1">Base Salary</p>
                  <p
                    className={`text-xl sm:text-3xl font-primary font-bold text-gray-800 transition-all duration-300 ${
                      !showSalary ? 'blur-md select-none' : ''
                    }`}
                  >
                    {showSalary ? formatCurrency(baseSalary) : '••••••'}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-2 rounded-xl shadow-lg">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-gray-600 font-secondary mb-1">Annual Salary</p>
                  <p
                    className={`text-xl sm:text-3xl font-primary font-bold text-gray-800 transition-all duration-300 ${
                      !showSalary ? 'blur-md select-none' : ''
                    }`}
                  >
                    {showSalary ? formatCurrency(totalAnnualSalary) : '••••••'}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-xl shadow-lg">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-5 border border-white/50 hover:shadow-xl transition-shadow hidden sm:block"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-secondary mb-1">Currency</p>
                  <p className="text-3xl font-primary font-bold text-gray-800">INR</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-2 rounded-xl shadow-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Bank Details & Personal Information Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-primary to-purple-600 p-2.5 rounded-lg shadow-lg">
                  <CreditCard className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-primary font-bold text-gray-800">Bank Details & Personal Information</h2>
                  <p className="text-xs text-gray-600 font-secondary">Manage your bank account and personal details</p>
                </div>
              </div>
              {!showBankForm && (
                <button
                  onClick={() => setShowBankForm(true)}
                  className="px-4 py-2 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-secondary text-xs sm:text-sm font-medium"
                >
                  {user?.accountNumber ? 'Update' : 'Add'} Bank Details
                </button>
              )}
            </div>

            {showBankForm ? (
              <form onSubmit={handleBankSubmit} className="space-y-3 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-secondary">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      value={bankFormData.bankName}
                      onChange={(e) => setBankFormData({ ...bankFormData, bankName: e.target.value })}
                      required
                      placeholder="Enter bank name"
                      className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-secondary">
                      Account Number *
                    </label>
                    <input
                      type="text"
                      value={bankFormData.accountNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, accountNumber: e.target.value })}
                      required
                      placeholder="Enter account number"
                      className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-secondary">
                      IFSC Code *
                    </label>
                    <input
                      type="text"
                      value={bankFormData.ifscCode}
                      onChange={(e) => setBankFormData({ ...bankFormData, ifscCode: e.target.value.toUpperCase() })}
                      required
                      placeholder="Enter IFSC code"
                      maxLength={11}
                      className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm uppercase"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-secondary">
                      Location
                    </label>
                    <input
                      type="text"
                      value={bankFormData.location}
                      onChange={(e) => setBankFormData({ ...bankFormData, location: e.target.value })}
                      placeholder="Enter location"
                      className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-secondary">
                      PAN No
                    </label>
                    <input
                      type="text"
                      value={bankFormData.panNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, panNumber: e.target.value.toUpperCase() })}
                      placeholder="Enter PAN number"
                      maxLength={10}
                      className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-secondary">
                      Aadhar No
                    </label>
                    <input
                      type="text"
                      value={bankFormData.aadharNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, aadharNumber: e.target.value.replace(/\D/g, '') })}
                      placeholder="Enter Aadhar number"
                      maxLength={12}
                      className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={bankLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-secondary text-sm font-medium disabled:opacity-50"
                  >
                    {bankLoading ? (
                      <>
                        <LoadingDots size="sm" color="white" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Save
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBankForm(false);
                      setBankFormData({
                        bankName: user?.bankName || '',
                        accountNumber: user?.accountNumber || '',
                        ifscCode: user?.ifscCode || '',
                        location: user?.location || '',
                        panNumber: user?.panNumber || '',
                        aadharNumber: user?.aadharNumber || '',
                      });
                    }}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300/50 text-gray-700 rounded-lg hover:bg-gray-50/80 transition-all font-secondary text-sm font-medium"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              </form>
            ) : user?.accountNumber ? (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-600" />
                      <span className="text-xs text-gray-500 font-secondary">Bank Name</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 font-secondary">{user.bankName || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-gray-600" />
                      <span className="text-xs text-gray-500 font-secondary">Account Number</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 font-secondary">{user.accountNumber || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-gray-600" />
                      <span className="text-xs text-gray-500 font-secondary">IFSC Code</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 font-secondary">{user.ifscCode || 'N/A'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-600" />
                      <span className="text-xs text-gray-500 font-secondary">Location</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 font-secondary">{user.location || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-gray-600" />
                      <span className="text-xs text-gray-500 font-secondary">PAN No</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 font-secondary">{user.panNumber || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-gray-600" />
                      <span className="text-xs text-gray-500 font-secondary">Aadhar No</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 font-secondary">{user.aadharNumber || 'N/A'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 p-3 bg-yellow-50/50 rounded-lg border border-yellow-200/50">
                <p className="text-xs text-gray-600 font-secondary">
                  No bank details added yet. Click &quot;Add Bank Details&quot; to add your bank information.
                </p>
              </div>
            )}
          </div>

          {/* Documents Section - Always Visible */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-primary to-purple-600 p-2.5 rounded-lg shadow-lg">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-primary font-bold text-gray-800">Documents</h2>
                  <p className="text-xs text-gray-600 font-secondary">Upload your PAN and Aadhar card documents</p>
                </div>
              </div>
              <button
                onClick={() => setDocumentsExpanded(!documentsExpanded)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title={documentsExpanded ? 'Minimize' : 'Expand'}
              >
                {documentsExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            </div>

            {documentsExpanded && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PAN Card */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700 font-secondary">PAN Card</label>
                {(userDocuments.panCardImage && userDocuments.panCardImage.trim() !== '') || (docPreview['general']?.pan && docPreview['general']?.pan.trim() !== '') ? (
                  <div className="relative">
                    <img
                      src={userDocuments.panCardImage || docPreview['general']?.pan}
                      alt="PAN Card"
                      className="w-full h-40 object-cover rounded-lg border border-gray-200"
                      onError={(e) => {
                        console.error('Error loading PAN card image');
                        // If image fails to load, clear it from state
                        setUserDocuments(prev => ({ ...prev, panCardImage: undefined }));
                      }}
                    />
                    <button
                      onClick={() => handleRemoveDocument('pan')}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                      title="Remove PAN Card"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    {uploadingDocs['general-pan'] ? (
                      <div className="flex flex-col items-center gap-2">
                        <LoadingDots size="sm" />
                        <span className="text-xs text-gray-500">Uploading...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-6 h-6 text-gray-400" />
                        <span className="text-xs text-gray-600 font-secondary">Upload PAN Card</span>
                        <span className="text-xs text-gray-400 font-secondary">(Image format)</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleDocumentChange('pan', e)}
                      className="hidden"
                      disabled={uploadingDocs['general-pan']}
                    />
                  </label>
                )}
              </div>

              {/* Aadhar Card */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700 font-secondary">Aadhar Card</label>
                {(userDocuments.aadharCardImage && userDocuments.aadharCardImage.trim() !== '') || (docPreview['general']?.aadhar && docPreview['general']?.aadhar.trim() !== '') ? (
                  <div className="relative">
                    <img
                      src={userDocuments.aadharCardImage || docPreview['general']?.aadhar}
                      alt="Aadhar Card"
                      className="w-full h-40 object-cover rounded-lg border border-gray-200"
                      onError={(e) => {
                        console.error('Error loading Aadhar card image');
                        // If image fails to load, clear it from state
                        setUserDocuments(prev => ({ ...prev, aadharCardImage: undefined }));
                      }}
                    />
                    <button
                      onClick={() => handleRemoveDocument('aadhar')}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                      title="Remove Aadhar Card"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    {uploadingDocs['general-aadhar'] ? (
                      <div className="flex flex-col items-center gap-2">
                        <LoadingDots size="sm" />
                        <span className="text-xs text-gray-500">Uploading...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-6 h-6 text-gray-400" />
                        <span className="text-xs text-gray-600 font-secondary">Upload Aadhar Card</span>
                        <span className="text-xs text-gray-400 font-secondary">(Image format)</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleDocumentChange('aadhar', e)}
                      className="hidden"
                      disabled={uploadingDocs['general-aadhar']}
                    />
                  </label>
                )}
              </div>
            </div>
            )}
          </div>

          {/* Salary Records */}
          {loading ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-8 flex flex-col items-center justify-center">
              <LoadingDots size="lg" className="mb-3" />
              <p className="text-xs text-gray-500 font-secondary">Loading salary data...</p>
            </div>
          ) : finances.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-8 text-center">
              <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-secondary">No salary records yet</p>
              <p className="text-xs text-gray-500 font-secondary mt-1">
                Your salary information will appear here once allocated
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {finances.map((finance, index) => (
                <motion.div
                  key={finance._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-5 hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-gradient-to-br from-primary to-purple-600 p-2 rounded-lg shadow-lg">
                        <Calendar className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 font-primary text-sm">
                          {getMonthName(finance.month)} {finance.year}
                        </div>
                        <div className="text-xs text-gray-500 font-secondary">
                          {format(new Date(finance.createdAt), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-semibold text-gray-700 font-primary">
                        Salary
                      </span>
                      <span
                        className={`text-xl font-bold text-primary font-primary transition-all duration-300 ${
                          !showSalary ? 'blur-md select-none' : ''
                        }`}
                      >
                        {showSalary ? formatCurrency(finance.baseSalary) : '••••••'}
                      </span>
                    </div>

                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Password Verification Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white/80 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 p-5 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-primary to-purple-600 p-2.5 rounded-lg shadow-lg">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-primary font-bold text-gray-800">Verify Password</h2>
                    <p className="text-xs text-gray-600 font-secondary">Enter your password to view salary details</p>
                  </div>
                </div>
                <button
                  onClick={handleClosePasswordModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePasswordVerify} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-secondary">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute z-10 left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError('');
                      }}
                      required
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-3 py-2 text-sm text-gray-700 border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none font-secondary bg-white/80 backdrop-blur-sm"
                      autoFocus
                    />
                  </div>
                  {passwordError && (
                    <p className="mt-1.5 text-xs text-red-600 font-secondary">{passwordError}</p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleClosePasswordModal}
                    className="flex-1 px-4 py-2 text-sm border border-gray-300/50 rounded-lg text-gray-700 hover:bg-gray-50/80 transition-all font-secondary backdrop-blur-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={verifyingPassword || !password}
                    className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 font-secondary flex items-center justify-center gap-2 backdrop-blur-sm"
                  >
                    {verifyingPassword ? (
                      <>
                        <LoadingDots size="sm" color="white" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        Verify
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
