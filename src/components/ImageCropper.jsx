/**
 * ImageCropper.jsx
 * Serbest boyutlandırılabilir kırpma alanı — react-image-crop kullanır.
 * Kullanıcı kırpma kutusunu kenarlarından sürükleyerek ayarlayabilir.
 */
import React, { useState, useRef, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, RotateCw } from 'lucide-react';

function getCroppedBlob(image, crop) {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0, 0,
    canvas.width,
    canvas.height
  );
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
}

export default function ImageCropper({ imageSrc, onCropped, onClose, isDark }) {
  const imgRef = useRef(null);
  const [crop, setCrop] = useState({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    if (!completedCrop || !imgRef.current) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop);
      const file = new File([blob], `cropped_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCropped(file);
    } catch (e) {
      console.error('Crop error:', e);
    }
    setProcessing(false);
  };

  const bg = isDark ? '#0c1526' : '#fff';
  const text = isDark ? '#f1f5f9' : '#1e293b';
  const muted = isDark ? '#64748b' : '#94a3b8';
  const border = isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0';

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: bg, border: `1px solid ${border}` }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: `1px solid ${border}` }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: text }}>Görsel Kırp</h3>
            <p className="text-[10px] mt-0.5" style={{ color: muted }}>Kırpma alanını köşelerinden veya kenarlarından sürükleyerek ayarlayın</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: muted }}>
            <X size={16}/>
          </button>
        </div>

        {/* Crop Area */}
        <div className="flex items-center justify-center p-4"
          style={{ background: isDark ? '#000' : '#f1f5f9', maxHeight: '60vh', overflow: 'auto' }}>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            style={{ maxHeight: '55vh' }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Kırpılacak görsel"
              style={{ maxHeight: '55vh', maxWidth: '100%', objectFit: 'contain' }}
              crossOrigin="anonymous"
            />
          </ReactCrop>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex gap-3" style={{ borderTop: `1px solid ${border}` }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
            style={{ borderColor: border, color: muted }}>
            İptal
          </button>
          <button onClick={handleConfirm} disabled={processing || !completedCrop}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: '#8b5cf6', opacity: processing || !completedCrop ? 0.5 : 1 }}>
            {processing ? (
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>
            ) : (
              <Check size={14}/>
            )}
            Kırp ve Kullan
          </button>
        </div>
      </div>
    </div>
  );
}
