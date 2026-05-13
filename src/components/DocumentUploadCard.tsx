import React, { useRef, useState } from 'react';
import { Upload, CheckCircle2, Loader2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { compressImage } from '@/lib/compressImage';

interface Props {
  title: string;
  description: string;
  onUpload: (file: File) => Promise<void>;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  imageUrl?: string;
}

export function DocumentUploadCard({ title, description, onUpload, status, imageUrl }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    try {
      const compressed = await compressImage(file);
      await onUpload(compressed);
    } catch (error: any) {
      setErrorMsg(error.message || 'Compression or upload failed');
    }
  };

  return (
    <div className="bg-white border-2 border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden transition-all">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{description}</p>
        </div>
        <div>
          {status === 'completed' && <CheckCircle2 className="text-green-500" size={24} />}
          {status === 'uploading' && <Loader2 className="text-[#176b4d] animate-spin" size={24} />}
          {status === 'error' && <AlertCircle className="text-red-500" size={24} />}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 text-xs font-bold p-2 rounded-lg mt-2 mb-2">
          {errorMsg}
        </div>
      )}

      {status === 'completed' && imageUrl ? (
        <div className="mt-4 relative rounded-2xl overflow-hidden border-2 border-slate-100 bg-slate-50 aspect-video flex items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <p className="text-white font-bold text-xs">Tap to replace</p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={status === 'uploading'}
          className="mt-4 w-full border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-slate-500 hover:text-slate-700"
        >
          <Upload size={24} className="mb-2" />
          <span className="text-xs font-black uppercase tracking-widest">Tap to Upload</span>
          <span className="text-[10px] font-medium text-slate-400">JPEG, PNG, WEBP (Max 5MB before compress)</span>
        </button>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
