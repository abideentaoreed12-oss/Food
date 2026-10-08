import React, { useState, useRef } from 'react';
import { Star, X, CheckCircle2, Loader2, Sparkles, Utensils, Bike, MessageSquare, Image as ImageIcon, Camera, FileImage, AlertCircle, CloudUpload, Trash2 } from 'lucide-react';
import { Order } from '../../types';
import { api } from '../../services/api';
import { useDelivery } from '../../context/DeliveryContext';

interface OrderReviewModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onReviewSubmitted?: (reviewData: { foodRating: number; deliveryRating?: number; comment?: string }) => void;
}

const QUICK_TAGS = [
  '🔥 Hot & Fresh',
  '⚡ Super Fast Delivery',
  '😋 Delicious Flavor',
  '📦 Perfect Packaging',
  '🛵 Friendly Rider',
  '🍱 Generous Portion'
];

export const OrderReviewModal: React.FC<OrderReviewModalProps> = ({
  order,
  isOpen,
  onClose,
  onReviewSubmitted
}) => {
  const { refreshData } = useDelivery();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [foodRating, setFoodRating] = useState<number>(5);
  const [hoverFoodRating, setHoverFoodRating] = useState<number | null>(null);

  const [deliveryRating, setDeliveryRating] = useState<number>(5);
  const [hoverDeliveryRating, setHoverDeliveryRating] = useState<number | null>(null);

  const [comment, setComment] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const getRatingLabel = (rating: number) => {
    switch (rating) {
      case 1:
        return 'Needs Improvement';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Very Good';
      case 5:
        return 'Exceptional!';
      default:
        return 'Rate order';
    }
  };

  /**
   * Reads photo from device camera or gallery and uploads directly to Platform R2
   */
  const handlePhotoFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setUploadError('Image size exceeds 10MB. Please choose a smaller photo.');
      return;
    }

    setIsUploadingPhoto(true);
    setUploadError(null);
    setUploadSuccessMsg(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target?.result as string;
          if (!base64Data) {
            throw new Error('Failed to read image file data.');
          }

          const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9\._\-]/g, '');
          const key = `reviews/photos/rev-${Date.now()}-${sanitizedFilename || 'food.jpg'}`;

          // Upload directly to Platform R2 via storage API
          const uploadRes = await api.storage.upload(key, base64Data, file.type);
          
          if (uploadRes && uploadRes.cdnUrl) {
            setPhotoUrl(uploadRes.cdnUrl);
            setUploadSuccessMsg('Photo uploaded live to Platform R2 storage!');
          } else if (uploadRes && uploadRes.data?.cdnUrl) {
            setPhotoUrl(uploadRes.data.cdnUrl);
            setUploadSuccessMsg('Photo uploaded live to Platform R2 storage!');
          } else {
            throw new Error('Platform R2 upload failed. Please try again.');
          }
        } catch (err: any) {
          console.error('Platform R2 Upload Error:', err);
          setUploadError(err.message || 'Failed to upload photo to Platform R2 storage.');
        } finally {
          setIsUploadingPhoto(false);
        }
      };

      reader.onerror = () => {
        setUploadError('Could not read image file.');
        setIsUploadingPhoto(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed.');
      setIsUploadingPhoto(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handlePhotoFile(files[0]);
    }
    // Reset file input value so same photo can be picked again if removed
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order.id || !order.restaurantId) {
      setSubmitError('Invalid order context. Missing restaurant ID.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    // Combine comment with selected quick tags
    const combinedComment = [
      selectedTags.length > 0 ? `[${selectedTags.join(', ')}]` : '',
      comment.trim()
    ].filter(Boolean).join(' ');

    try {
      await api.reviews.submit({
        orderId: order.id,
        restaurantId: order.restaurantId,
        courierId: order.courier?.id,
        foodRating,
        deliveryRating,
        comment: combinedComment,
        photoR2Url: photoUrl.trim() || undefined
      });

      setSubmitSuccess(true);
      
      // Live refresh of D1 backend restaurant data
      await refreshData();

      if (onReviewSubmitted) {
        onReviewSubmitted({
          foodRating,
          deliveryRating,
          comment: combinedComment
        });
      }

      setTimeout(() => {
        setIsSubmitting(false);
        setSubmitSuccess(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('D1 Review Submission Error:', err);
      setSubmitError(err.message || 'Failed to submit review directly to Platform D1. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      {/* Hidden File Inputs for Device Camera and Gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 relative overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-orange-100 text-[#FF5500]">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="text-base font-extrabold text-slate-900">
                Rate & Review Meal
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Order <span className="font-mono font-bold text-slate-800">{order.shortId}</span> from{' '}
              <span className="font-bold text-slate-900">{order.restaurantName}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitSuccess ? (
          <div className="py-8 text-center space-y-3 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h4 className="text-lg font-extrabold text-slate-900">Thank You for Your Feedback!</h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Your review and meal photo have been saved live directly to Platform D1 database and Platform R2 storage.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Platform D1 & R2 Storage Synchronized Live</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error banner */}
            {submitError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{submitError}</span>
              </div>
            )}

            {/* 1. Food Quality Rating */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-[#FF5500]" />
                  <span>Food Quality & Taste</span>
                </span>
                <span className="text-xs font-extrabold text-[#FF5500] font-mono">
                  {getRatingLabel(hoverFoodRating ?? foodRating)}
                </span>
              </div>

              {/* Star Rating Buttons */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= (hoverFoodRating ?? foodRating);
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFoodRating(star)}
                      onMouseEnter={() => setHoverFoodRating(star)}
                      onMouseLeave={() => setHoverFoodRating(null)}
                      className="p-1 rounded-lg hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          active
                            ? 'text-amber-400 fill-amber-400 drop-shadow-2xs'
                            : 'text-slate-300 hover:text-amber-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Delivery Service Rating */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-sky-600" />
                  <span>Delivery Speed & Service</span>
                </span>
                <span className="text-xs font-extrabold text-sky-600 font-mono">
                  {getRatingLabel(hoverDeliveryRating ?? deliveryRating)}
                </span>
              </div>

              {/* Star Rating Buttons */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= (hoverDeliveryRating ?? deliveryRating);
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setDeliveryRating(star)}
                      onMouseEnter={() => setHoverDeliveryRating(star)}
                      onMouseLeave={() => setHoverDeliveryRating(null)}
                      className="p-1 rounded-lg hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          active
                            ? 'text-sky-500 fill-sky-500 drop-shadow-2xs'
                            : 'text-slate-300 hover:text-sky-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Complement Tags */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Quick Compliments
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-orange-50 text-[#FF5500] border-orange-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Comment Box */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <span>Written Review (Optional)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {comment.length}/500
                </span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Tell others what you loved about the food, portion size, or packaging..."
                className="w-full p-3 text-xs rounded-2xl bg-white border border-slate-200 focus:outline-none focus:border-[#FF5500] focus:ring-2 focus:ring-orange-100 transition-all text-slate-900 placeholder-slate-400 resize-none"
              />
            </div>

            {/* 3. Enhanced Photo Attachment Section (Device Camera & Gallery to Platform R2) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#FF5500]" />
                  <span>Attach Food Photo (R2 Storage)</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Platform R2 Ready
                </span>
              </label>

              {/* Upload Status / Error / Success Messages */}
              {uploadError && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </p>
              )}

              {uploadSuccessMsg && !photoUrl && (
                <p className="text-xs font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  <span>{uploadSuccessMsg}</span>
                </p>
              )}

              {/* Uploading State */}
              {isUploadingPhoto ? (
                <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200 text-center space-y-2 animate-pulse">
                  <Loader2 className="w-6 h-6 text-[#FF5500] animate-spin mx-auto" />
                  <p className="text-xs font-extrabold text-[#FF5500]">
                    Uploading photo live to Platform R2 bucket...
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Bucket: <span className="font-mono">veyrang-production-storage</span>
                  </p>
                </div>
              ) : photoUrl ? (
                /* Photo Uploaded Preview Card */
                <div className="relative p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3 group">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-300 relative shadow-2xs">
                    <img
                      src={photoUrl}
                      alt="Food review attachment"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-slate-900 truncate">
                        Meal Photo Attached
                      </span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                        R2 CDN URL
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono truncate">
                      {photoUrl}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPhotoUrl('');
                      setUploadSuccessMsg(null);
                    }}
                    title="Remove Photo"
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* Camera & Gallery Input Buttons Dropzone */
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="p-3.5 rounded-2xl bg-orange-50/80 hover:bg-orange-100 border border-orange-200/90 text-[#FF5500] transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer group shadow-2xs"
                  >
                    <div className="p-2 rounded-xl bg-white text-[#FF5500] shadow-xs group-hover:scale-110 transition-transform">
                      <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold">Take Photo (Camera)</span>
                    <span className="text-[10px] text-slate-500 font-medium">Device Camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer group shadow-2xs"
                  >
                    <div className="p-2 rounded-xl bg-white text-slate-700 shadow-xs group-hover:scale-110 transition-transform">
                      <FileImage className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold">Upload from Gallery</span>
                    <span className="text-[10px] text-slate-500 font-medium">Photos / Library</span>
                  </button>
                </div>
              )}
            </div>

            {/* Submit CTA */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || isUploadingPhoto}
                className="w-1/3 py-3 px-4 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || isUploadingPhoto}
                className="w-2/3 py-3 px-4 rounded-2xl bg-[#FF5500] text-white text-xs font-extrabold hover:bg-[#EA4C00] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Writing directly to D1 Database...</span>
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4 fill-white text-white" />
                    <span>Submit Review Live to D1</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
