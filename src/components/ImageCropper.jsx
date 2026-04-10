/**
 * ImageCropper.jsx
 * Modal-based image cropper using react-easy-crop.
 * Accepts a File or URL, allows free-form crop, returns cropped blob.
 */
import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

// Canvas'ta kırpma
async function getCroppedImg(imageSrc, crop, rotation = 0) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const bW = image.width * cos + image.height * sin;
  const bH = image.width * sin + image.height * cos;

  canvas.width = bW;
  canvas.height = bH;
  ctx.translate(bW / 2, bH / 2);
  ctx.rotate(radians);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  const data = ctx.getImageData(crop.x, crop.y, crop.width, crop.height);
  canvas.width = crop.width;
  canvas.height = crop.height;
  ctx.putImageData(data, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.92);
  });
}

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (e) => reject(e));
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

export default function ImageCropper({ imageSrc, onCropped, onClose, isDark }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
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
      <div className="w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: bg, border: `1px solid ${border}` }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: `1px solid ${border}` }}>
          <h3 className="text-sm font-bold" style={{ color: text }}>Görsel Kırp</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: muted }}>
            <X size={16}/>
          </button>
        </div>

        {/* Cropper Area */}
        <div className="relative" style={{ height: 380, background: '#000' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { borderRadius: 0 },
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-5 py-4 space-y-3" style={{ borderTop: `1px solid ${border}` }}>
          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <ZoomOut size={14} style={{ color: muted }}/>
            <input type="range" min={1} max={3} step={0.05} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#8b5cf6', background: border }}/>
            <ZoomIn size={14} style={{ color: muted }}/>
            <button onClick={() => setRotation(r => (r + 90) % 360)}
              className="p-1.5 rounded-lg ml-1" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: muted }}
              title="Döndür">
              <RotateCw size={14}/>
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
              style={{ borderColor: border, color: muted }}>
              İptal
            </button>
            <button onClick={handleConfirm} disabled={processing}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
              style={{ background: '#8b5cf6', opacity: processing ? 0.6 : 1 }}>
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
    </div>
  );
}
