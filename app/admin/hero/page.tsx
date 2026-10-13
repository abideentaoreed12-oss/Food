'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PortalAuthGuard } from '../../../src/components/auth/PortalAuthGuard';
import { ROUTES } from '../../../src/routes';
import { api } from '../../../src/services/api';
import { Upload, Trash2, CheckCircle, ArrowLeft, Image as ImageIcon, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

export default function AdminHeroImageManagerPage() {
  const router = useRouter();
  const [platformSettings, setPlatformSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await api.settings.get();
      const extracted = res?.settings || res?.data?.settings || res || {};
      setPlatformSettings(extracted);
    } catch (err) {
      console.error('Failed to load platform settings', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleFileUpload = async (key: string, file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ message: 'File size must be under 5MB.', type: 'error' });
      return;
    }

    setUploadingKey(key);
    setFeedback(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64String = (reader.result as string).split(',')[1];
        const fileKey = `hero_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        // 1. Upload to storage (Cloudflare R2 / persistent local)
        const uploadRes = await api.admin.uploadAsset(
          fileKey,
          base64String,
          file.type || 'image/jpeg'
        );

        const cdnUrl = uploadRes?.cdnUrl || uploadRes?.data?.cdnUrl;
        if (!cdnUrl) {
          throw new Error(uploadRes?.error || 'Upload failed to return CDN URL');
        }

        // 2. Save directly to platformSettings
        const updated = { ...platformSettings, [key]: cdnUrl };
        await api.settings.bulkUpdate(updated);
        setPlatformSettings(updated);

        setFeedback({ message: '✓ Picture updated directly and saved to cloud storage!', type: 'success' });
      } catch (err: any) {
        setFeedback({ message: err?.message || 'Failed to upload image.', type: 'error' });
      } finally {
        setUploadingKey(null);
      }
    };
    reader.onerror = () => {
      setUploadingKey(null);
      setFeedback({ message: 'Failed to read image file.', type: 'error' });
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = async (key: string) => {
    if (!window.confirm('Are you sure you want to remove this custom picture?')) return;
    setDeletingKey(key);
    setFeedback(null);
    try {
      const currentVal = platformSettings[key];
      if (currentVal && currentVal.includes('/storage/file/')) {
        const extractedKey = currentVal.split('/storage/file/')[1];
        if (extractedKey) {
          await api.admin.deleteAsset(decodeURIComponent(extractedKey)).catch(() => {});
        }
      }

      const updated = { ...platformSettings, [key]: '' };
      await api.settings.bulkUpdate(updated);
      setPlatformSettings(updated);
      setFeedback({ message: '✓ Picture removed successfully.', type: 'success' });
    } catch (err: any) {
      setFeedback({ message: err?.message || 'Failed to remove picture.', type: 'error' });
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <PortalAuthGuard requiredRole="admin">
      <div className="min-h-screen bg-[#F6F3EE] text-slate-900 pb-20">
        {/* Top Navbar Header */}
        <header className="bg-[#093A2D] text-white border-b border-[#147A5A]/30 sticky top-0 z-30 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(ROUTES.ADMIN_PORTAL)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                title="Back to Admin Portal"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-base font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E8C547]" />
                  <span>Green Hero & Storefront Image Control</span>
                </h1>
                <p className="text-[11px] text-emerald-200/80">Direct R2 Storage Uploader & Instant Storefront Publisher</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchSettings}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-3.5 py-1.5 bg-[#E8C547] hover:bg-[#dfba3e] text-slate-950 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-colors"
              >
                View Live Storefront →
              </button>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
          {feedback && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-bold ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
              {feedback.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-5">
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <span>Direct Cloud Storage & Immediate Display</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">R2 Powered</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Upload or change the green background banner and hero dish images directly. Changes update instantly across all active customer sessions without relying on third-party render links.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Green Hero Background Picture */}
              <div className="p-5 bg-[#F4F9F6] border border-[#CDEADF] rounded-2xl space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0D4F3C]">Green Hero Background Overlay</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-emerald-200">cms_hero_bg_image</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Custom background image or texture for the forest-green hero banner at the top of the homepage.
                  </p>

                  <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-emerald-300/60 bg-gradient-to-b from-[#0D4F3C] via-[#0A4333] to-[#08382B] flex items-center justify-center shadow-inner">
                    {platformSettings['cms_hero_bg_image'] ? (
                      <img
                        src={platformSettings['cms_hero_bg_image']}
                        alt="Green Hero Background"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-center p-4 text-emerald-100 space-y-1">
                        <ImageIcon className="w-8 h-8 mx-auto text-emerald-300/70" />
                        <span className="text-xs font-medium">Using Default Forest Gradient (#0D4F3C)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-emerald-200/60">
                  <label className="flex-1 py-2.5 bg-[#0D4F3C] hover:bg-[#062820] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>{uploadingKey === 'cms_hero_bg_image' ? 'Uploading...' : 'Upload New Background'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingKey === 'cms_hero_bg_image'}
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleFileUpload('cms_hero_bg_image', e.target.files[0]);
                      }}
                    />
                  </label>
                  {platformSettings['cms_hero_bg_image'] && (
                    <button
                      onClick={() => handleDeleteImage('cms_hero_bg_image')}
                      disabled={deletingKey === 'cms_hero_bg_image'}
                      className="p-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl cursor-pointer transition-colors"
                      title="Remove custom background"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Card 2: Hero Featured Dish Picture */}
              <div className="p-5 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Hero Circular Spotlight Dish</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-amber-200">cms_hero_dish1_image</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The prominent circular featured meal displayed on the right side of the homepage hero banner.
                  </p>

                  <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-amber-300/60 bg-slate-900 flex items-center justify-center shadow-inner">
                    {platformSettings['cms_hero_dish1_image'] || '/hero_jollof_bowl.jpg' ? (
                      <img
                        src={platformSettings['cms_hero_dish1_image'] || '/hero_jollof_bowl.jpg'}
                        alt="Hero Featured Dish"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-center p-4 text-slate-300 space-y-1">
                        <ImageIcon className="w-8 h-8 mx-auto text-slate-500" />
                        <span className="text-xs font-medium">Default Jollof Dish</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-amber-200/60">
                  <label className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>{uploadingKey === 'cms_hero_dish1_image' ? 'Uploading...' : 'Upload New Dish Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingKey === 'cms_hero_dish1_image'}
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleFileUpload('cms_hero_dish1_image', e.target.files[0]);
                      }}
                    />
                  </label>
                  {platformSettings['cms_hero_dish1_image'] && (
                    <button
                      onClick={() => handleDeleteImage('cms_hero_dish1_image')}
                      disabled={deletingKey === 'cms_hero_dish1_image'}
                      className="p-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl cursor-pointer transition-colors"
                      title="Remove custom dish image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick URL fallback or developer note */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600">
                <span className="font-bold text-slate-900">Direct storage guarantee:</span> All uploads are stored securely in Cloudflare R2 (or local persistent storage fallback) and served with lightning-fast CDN caching.
              </div>
              <button
                onClick={() => router.push(ROUTES.ADMIN_PORTAL)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors"
              >
                Return to Admin Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    </PortalAuthGuard>
  );
}
