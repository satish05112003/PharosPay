import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { BrowserQRCodeReader } from '@zxing/browser';
import { API_BASE } from '../config';
import { Ic } from './Icons';

const SAMPLE_QR_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACXljzdAAAABlBMVEX///8AAABVwtN+AAAACXBIWXMAAA7EAAAOxAGVKw4bAAABk0lEQVRYhdWYvbGEMAyE5SF4oUugFDrDLo1SKIGQgEFvd8XdvJ+5GOEI6yM4mdVKPrOPqzmXDb6ZncOOSFHkTEBm/UDuFr60Fl5OhpKTAduGx+q9+D46SHXvTyCI8fyPL1/sOSS044eNDyEv7WwS/8qs/qjqNhLViFPepo5qHJf2u05zkveqC9QNhbR/RpeQ6OibIx8pBIFz2EbyzMSoa3j0Dg/BLnS94oukJlQNc/BtkmYWdhm4tuUmKk4QxJgPs6orH+8ns7bUxtSLPIR1OF19Oy3BKY9d1Wju9BBqxpMT+gZmJIPz0f+UD3uJpSbsKchnuKrRRFZruUl0mcgnvgKcz1iNmcmsTKTyXjRt6FXNIbcTzptQsVzOqBAMHnKS5AQKOUMh9D9MG+iAlp2wGjnZXc4Xkum5SawgnJWp8bqGa+cl8fOvKZr3ksZpg29nJjH7m3QP7cjzqi85SNz03lMnXc41vz2B0PmCFF76mj2BSCGvCqy6naQm0g7/BYBr6w7Iz5Cd/KhGixg7JJ0vM/m4vgEp3ndt1XaHHQAAAABJRU5ErkJggg==";

function EmptyState({ iconName, title, subtitle, children }) {
  return (
    <div className="empty-state">
      <div className="icon-circle" style={{ background: 'var(--primary-light)' }}>
        <Ic name={iconName} color="var(--primary)" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', margin: '0 0 6px 0' }}>
          {title}
        </h4>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, maxWidth: '280px', lineHeight: '1.4' }}>
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  );
}

export default function QRScanner({ onScanSuccess }) {
  const [mode, setMode] = useState('cam'); // 'cam' | 'up'
  const [isScanning, setIsScanning] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [flashOn, setFlashOn] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  
  // Drag & drop / Clipboard states
  const [dragActive, setDragActive] = useState(false);
  
  // Image upload preprocessor debug states
  const [imagePreview, setImagePreview] = useState(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [debugUrls, setDebugUrls] = useState({ original: null, cropped: null, binarized: null, scaled: null });
  const [decodedTextValue, setDecodedTextValue] = useState('');
  const [error, setError] = useState(null);
  
  const html5QrRef = useRef(null);

  // ─── Camera Access ─────────────────────────────────────────────────────
  const initCameras = async () => {
    setError(null);
    setCameraLoading(true);
    setScanSuccess(false);
    try {
      const devices = await Html5Qrcode.getCameras();
      setCameras(devices);
      if (devices.length > 0) {
        // Rear camera default filter
        const backCam = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('environment') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('camera2 0')
        );
        const defaultCamId = backCam ? backCam.id : devices[0].id;
        setSelectedCameraId(defaultCamId);
        await startScanner(defaultCamId);
      } else {
        setError('No camera devices detected. Verify connections.');
      }
    } catch (err) {
      console.error(err);
      setError('Camera access permission denied. Please check site permissions in your browser settings.');
    } finally {
      setCameraLoading(false);
    }
  };

  const startScanner = async (cameraId) => {
    setError(null);
    setCameraLoading(true);
    try {
      if (html5QrRef.current) {
        await stopScanner();
      }

      const scanner = new Html5Qrcode('qr-reader-target');
      html5QrRef.current = scanner;

      await scanner.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 220, height: 220 }
        },
        (decodedText) => {
          handleSuccessScan(decodedText);
        },
        () => {} // silent scan track errors
      );

      setIsScanning(true);
      
      try {
        const capabilities = scanner.getRunningTrackCapabilities();
        setHasFlash(!!(capabilities && capabilities.torch));
      } catch {
        setHasFlash(false);
      }
    } catch (err) {
      console.error(err);
      setError('Could not initialize camera feed. Please select a different camera or upload an image.');
    } finally {
      setCameraLoading(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrRef.current) {
      try {
        if (html5QrRef.current.isScanning) {
          await html5QrRef.current.stop();
        }
      } catch (err) {
        console.warn('Scanner stop warning:', err);
      }
      html5QrRef.current = null;
    }
    setIsScanning(false);
    setFlashOn(false);
  };

  const switchCamera = (cameraId) => {
    setSelectedCameraId(cameraId);
    if (isScanning) {
      startScanner(cameraId);
    }
  };

  const toggleFlash = async () => {
    if (!html5QrRef.current || !hasFlash) return;
    try {
      const nextFlash = !flashOn;
      await html5QrRef.current.applyVideoConstraints({
        advanced: [{ torch: nextFlash }]
      });
      setFlashOn(nextFlash);
    } catch (err) {
      console.warn('Flash error:', err);
    }
  };

  const handleSuccessScan = (decodedText) => {
    // Vibration feedback
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
    
    // Trigger Success check Animation
    setScanSuccess(true);
    stopScanner();

    // Delay callback to show anim
    setTimeout(() => {
      handleQRData(decodedText);
    }, 850);
  };

  // ─── Drag & Drop / Clipboard Paste Event Handlers ────────────────────────
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Paste image clipboard listener
  useEffect(() => {
    const handlePasteEvent = (e) => {
      if (mode !== 'up') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [mode]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const processFile = (file) => {
    setError(null);
    setImagePreview(null);
    setDecodedTextValue('');
    setDebugUrls({ original: null, cropped: null, binarized: null, scaled: null });
    setDebugLogs([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target.result);
      runMultiPassDecoder(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const triggerSampleTest = () => {
    setError(null);
    setImagePreview(SAMPLE_QR_BASE64);
    setDecodedTextValue('');
    setDebugUrls({ original: null, cropped: null, binarized: null, scaled: null });
    setDebugLogs([]);
    runMultiPassDecoder(SAMPLE_QR_BASE64);
  };

  // ─── Computer Vision Canvas Preprocessing Filter Functions ───────────────
  const convertToGrayscale = (ctx, w, h) => {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // 3x3 Sharpening matrix convolution filter
  const applySharpen = (ctx, w, h) => {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const copy = new Uint8ClampedArray(data);
    const weights = [
       0, -1,  0,
      -1,  5, -1,
       0, -1,  0
    ];
    
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const dstOff = (y * w + x) * 4;
        let r = 0, g = 0, b = 0;
        
        for (let cy = -1; cy <= 1; cy++) {
          for (let cx = -1; cx <= 1; cx++) {
            const srcOff = ((y + cy) * w + (x + cx)) * 4;
            const wt = weights[(cy + 1) * 3 + (cx + 1)];
            r += copy[srcOff] * wt;
            g += copy[srcOff + 1] * wt;
            b += copy[srcOff + 2] * wt;
          }
        }
        data[dstOff] = Math.min(255, Math.max(0, r));
        data[dstOff + 1] = Math.min(255, Math.max(0, g));
        data[dstOff + 2] = Math.min(255, Math.max(0, b));
      }
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // Otsu's adaptive binarization thresholding
  const applyOtsuThreshold = (ctx, w, h) => {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const histogram = new Int32Array(256);
    
    for (let i = 0; i < data.length; i += 4) {
      const val = Math.round((data[i] + data[i+1] + data[i+2]) / 3);
      histogram[val]++;
    }
    
    const total = w * h;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * histogram[t];
    
    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = 0;
    let threshold = 128;
    
    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      wF = total - wB;
      if (wF === 0) break;
      
      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      
      const varBetween = wB * wF * (mB - mF) * (mB - mF);
      if (varBetween > varMax) {
        varMax = varBetween;
        threshold = t;
      }
    }
    
    for (let i = 0; i < data.length; i += 4) {
      const val = (data[i] + data[i+1] + data[i+2]) / 3;
      const b = val < threshold ? 0 : 255;
      data[i] = b;
      data[i+1] = b;
      data[i+2] = b;
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // Detect QR bounding box from concentric finder patterns (1:1:3:1:1 ratio)
  const detectQRBoundingBox = (canvas) => {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] + data[i+1] + data[i+2]) / 3;
    }
    const threshold = sum / (data.length / 4);
    
    // Create binary array
    const grid = [];
    for (let y = 0; y < height; y++) {
      const row = new Uint8Array(width);
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const lum = (data[idx] + data[idx+1] + data[idx+2]) / 3;
        row[x] = lum < threshold ? 1 : 0; 
      }
      grid.push(row);
    }
    
    const centers = [];
    const scanStep = Math.max(2, Math.floor(height / 150));
    
    for (let y = 0; y < height; y += scanStep) {
      const row = grid[y];
      let runLength = 0;
      const runs = []; 
      let currentVal = row[0];
      
      for (let x = 0; x < width; x++) {
        if (row[x] === currentVal) {
          runLength++;
        } else {
          runs.push({ val: currentVal, length: runLength, startX: x - runLength });
          currentVal = row[x];
          runLength = 1;
        }
      }
      runs.push({ val: currentVal, length: runLength, startX: width - runLength });
      
      for (let i = 2; i < runs.length - 2; i++) {
        if (
          runs[i].val === 1 && 
          runs[i-1].val === 0 && 
          runs[i-2].val === 1 && 
          runs[i+1].val === 0 && 
          runs[i+2].val === 1    
        ) {
          const r1 = runs[i-2].length;
          const r2 = runs[i-1].length;
          const r3 = runs[i].length;
          const r4 = runs[i+1].length;
          const r5 = runs[i+2].length;
          
          const avg = (r1 + r2 + r4 + r5 + r3 / 3) / 5;
          const tol = avg * 0.55;
          
          if (
            Math.abs(r1 - avg) < tol &&
            Math.abs(r2 - avg) < tol &&
            Math.abs(r3 - avg * 3) < tol * 3 &&
            Math.abs(r4 - avg) < tol &&
            Math.abs(r5 - avg) < tol
          ) {
            const cx = runs[i].startX + Math.floor(r3 / 2);
            centers.push({ x: cx, y });
          }
        }
      }
    }
    
    if (centers.length < 3) return null;
    
    let minX = width, maxX = 0, minY = height, maxY = 0;
    centers.forEach(c => {
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
    });
    
    const boxW = maxX - minX;
    const boxH = maxY - minY;
    const padX = Math.max(30, Math.floor(boxW * 0.25));
    const padY = Math.max(30, Math.floor(boxH * 0.25));
    
    let rx = Math.max(0, minX - padX);
    let ry = Math.max(0, minY - padY);
    let rw = Math.min(width - rx, boxW + 2 * padX);
    let rh = Math.min(height - ry, boxH + 2 * padY);
    
    const squareSize = Math.max(rw, rh);
    rx = Math.max(0, Math.floor(rx - (squareSize - rw) / 2));
    ry = Math.max(0, Math.floor(ry - (squareSize - rh) / 2));
    rw = Math.min(width - rx, squareSize);
    rh = Math.min(height - ry, squareSize);
    
    return { x: rx, y: ry, width: rw, height: rh };
  };

  // ─── Multi-Pass ZXing Image Decoding Engine ──────────────────────────────
  const runMultiPassDecoder = (imageSrc) => {
    setIsDecoding(true);
    const logs = [];
    const addLog = (msg) => { logs.push(msg); setDebugLogs([...logs]); };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        const codeReader = new BrowserQRCodeReader();
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        
        // Normalize large screens to speed up CPU thresholds
        const maxDim = 1000;
        let scale = 1;
        if (width > maxDim || height > maxDim) {
          scale = maxDim / Math.max(width, height);
        }
        const tw = Math.floor(width * scale);
        const th = Math.floor(height * scale);

        // Canvas 1: Original
        const canvas1 = document.createElement('canvas');
        canvas1.width = tw;
        canvas1.height = th;
        const ctx1 = canvas1.getContext('2d');
        ctx1.drawImage(img, 0, 0, tw, th);
        setDebugUrls(prev => ({ ...prev, original: canvas1.toDataURL() }));

        // Pass 1: Original
        addLog(`Pass 1: Attempting decode on original image size (${tw}x${th})...`);
        try {
          const res = await codeReader.decodeFromCanvas(canvas1);
          setDecodedTextValue(res.getText());
          addLog("Pass 1: Decoded successfully!");
          handleQRData(res.getText());
          setIsDecoding(false);
          return;
        } catch (err) {
          addLog(`Pass 1 failed: ${err.message || 'No QR found'}`);
        }

        // Canvas 2: Grayscale + Sharpen
        const canvas2 = document.createElement('canvas');
        canvas2.width = tw;
        canvas2.height = th;
        const ctx2 = canvas2.getContext('2d');
        ctx2.drawImage(canvas1, 0, 0);
        convertToGrayscale(ctx2, tw, th);
        applySharpen(ctx2, tw, th);
        
        // Pass 2: Grayscale
        addLog("Pass 2: Attempting decode on grayscale sharpened image...");
        try {
          const res = await codeReader.decodeFromCanvas(canvas2);
          setDecodedTextValue(res.getText());
          addLog("Pass 2: Decoded successfully!");
          handleQRData(res.getText());
          setIsDecoding(false);
          return;
        } catch (err) {
          addLog(`Pass 2 failed: ${err.message || 'No QR found'}`);
        }

        // Canvas 3: High Contrast Otsu
        const canvas3 = document.createElement('canvas');
        canvas3.width = tw;
        canvas3.height = th;
        const ctx3 = canvas3.getContext('2d');
        ctx3.drawImage(canvas2, 0, 0);
        applyOtsuThreshold(ctx3, tw, th);
        setDebugUrls(prev => ({ ...prev, binarized: canvas3.toDataURL() }));

        // Pass 3: Decode High Contrast
        addLog("Pass 3: Attempting decode on high-contrast thresholded image...");
        try {
          const res = await codeReader.decodeFromCanvas(canvas3);
          setDecodedTextValue(res.getText());
          addLog("Pass 3: Decoded successfully!");
          handleQRData(res.getText());
          setIsDecoding(false);
          return;
        } catch (err) {
          addLog(`Pass 3 failed: ${err.message || 'No QR found'}`);
        }

        // Auto-cropping Finder-pattern region
        addLog("Analyzing finder patterns to isolate QR box region...");
        const qrBox = detectQRBoundingBox(canvas3);
        let croppedCanvas = null;

        if (qrBox) {
          addLog(`Isolate square match: x=${qrBox.x}, y=${qrBox.y}, size=${qrBox.width}x${qrBox.height}`);
          
          croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = qrBox.width;
          croppedCanvas.height = qrBox.height;
          const croppedCtx = croppedCanvas.getContext('2d');
          croppedCtx.drawImage(canvas1, qrBox.x, qrBox.y, qrBox.width, qrBox.height, 0, 0, qrBox.width, qrBox.height);
          setDebugUrls(prev => ({ ...prev, cropped: croppedCanvas.toDataURL() }));

          // Pass 4: Decode Crop
          addLog("Pass 4: Attempting decode on isolated QR crop...");
          try {
            const res = await codeReader.decodeFromCanvas(croppedCanvas);
            setDecodedTextValue(res.getText());
            addLog("Pass 4: Decoded successfully!");
            handleQRData(res.getText());
            setIsDecoding(false);
            return;
          } catch (err) {
            addLog(`Pass 4 failed: ${err.message || 'No QR found'}`);
          }
        } else {
          addLog("No direct finder patterns. Attempting center 60% fallback crop...");
          const size = Math.floor(Math.min(tw, th) * 0.6);
          const cx = Math.floor((tw - size) / 2);
          const cy = Math.floor((th - size) / 2);

          croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = size;
          croppedCanvas.height = size;
          const croppedCtx = croppedCanvas.getContext('2d');
          croppedCtx.drawImage(canvas1, cx, cy, size, size, 0, 0, size, size);
          setDebugUrls(prev => ({ ...prev, cropped: croppedCanvas.toDataURL() }));

          // Pass 4 Fallback: Decode Center Crop
          addLog("Pass 4: Attempting decode on center crop fallback...");
          try {
            const res = await codeReader.decodeFromCanvas(croppedCanvas);
            setDecodedTextValue(res.getText());
            addLog("Pass 4: Decoded successfully!");
            handleQRData(res.getText());
            setIsDecoding(false);
            return;
          } catch (err) {
            addLog(`Pass 4 failed: ${err.message || 'No QR found'}`);
          }
        }

        // Pass 5: 2x Scaled Bilinear Crop
        if (croppedCanvas) {
          const scaledCanvas = document.createElement('canvas');
          scaledCanvas.width = croppedCanvas.width * 2;
          scaledCanvas.height = croppedCanvas.height * 2;
          const scaledCtx = scaledCanvas.getContext('2d');
          scaledCtx.imageSmoothingEnabled = false; // pixel preservation
          scaledCtx.drawImage(croppedCanvas, 0, 0, croppedCanvas.width, croppedCanvas.height, 0, 0, scaledCanvas.width, scaledCanvas.height);
          
          applyOtsuThreshold(scaledCtx, scaledCanvas.width, scaledCanvas.height);
          applySharpen(scaledCtx, scaledCanvas.width, scaledCanvas.height);
          setDebugUrls(prev => ({ ...prev, scaled: scaledCanvas.toDataURL() }));

          addLog("Pass 5: Attempting decode on 2x scaled binarized sharpened QR crop...");
          try {
            const res = await codeReader.decodeFromCanvas(scaledCanvas);
            setDecodedTextValue(res.getText());
            addLog("Pass 5: Decoded successfully!");
            handleQRData(res.getText());
            setIsDecoding(false);
            return;
          } catch (err) {
            addLog(`Pass 5 failed: ${err.message || 'No QR found'}`);
          }
        }

        // Check if QR region was detected but decoding still failed
        if (qrBox) {
          setError('QR detected but content could not be decoded');
          addLog("Final: QR structure detected, but reading matrix patterns failed (low resolution/noise).");
        } else {
          setError('Could not decode QR code from the uploaded image. Make sure it is sharp and in frame.');
          addLog("Final: No QR code found after 5 decoding passes.");
        }
      } catch (err) {
        console.error(err);
        setError(err.message || 'An error occurred during image processing.');
      } finally {
        setIsDecoding(false);
      }
    };
    img.src = imageSrc;
  };

  const handleQRData = async (qrData) => {
    try {
      const res = await fetch(`${API_BASE}/parse-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData }),
      });
      const data = await res.json();

      if (data.success) {
        onScanSuccess(data.data);
      } else {
        onScanSuccess(localParse(qrData));
      }
    } catch {
      onScanSuccess(localParse(qrData));
    }
  };

  const localParse = (data) => {
    if (data.startsWith('upi://')) {
      const params = new URL(data).searchParams;
      return {
        merchantId: params.get('pa') || 'unknown@upi',
        merchantName: decodeURIComponent(params.get('pn') || 'Merchant'),
        amount: parseFloat(params.get('am')) || null,
        currency: 'INR',
        country: 'IN',
        paymentRail: 'UPI',
        fiatPair: 'USD/INR',
        rawFormat: 'UPI',
      };
    }
    if (data.includes('br.gov.bcb.pix') || data.startsWith('pix://')) {
      return {
        merchantId: 'pix-merchant-key',
        merchantName: 'PIX Merchant',
        amount: null,
        currency: 'BRL',
        country: 'BR',
        paymentRail: 'PIX',
        fiatPair: 'USD/BRL',
        rawFormat: 'PIX',
      };
    }
    if (data.startsWith('pharospay://')) {
      const url = new URL(data);
      const to = url.searchParams.get('to') || 'merchant';
      const rail = url.searchParams.get('rail') || 'ACH';
      const currency = url.searchParams.get('currency') || 'USD';
      
      const countryMapping = { UPI: 'IN', PIX: 'BR', PayNow: 'SG', ACH: 'US', PromptPay: 'TH', QRIS: 'ID' };
      
      return {
        merchantId: to,
        merchantName: decodeURIComponent(url.searchParams.get('name') || 'Merchant'),
        amount: parseFloat(url.searchParams.get('amount')) || null,
        currency: currency,
        country: countryMapping[rail] || 'US',
        paymentRail: rail,
        fiatPair: `USD/${currency}`,
        rawFormat: 'PharosPay',
      };
    }

    return {
      merchantId: data,
      merchantName: 'Decoded Merchant',
      amount: null,
      currency: 'USD',
      country: 'US',
      paymentRail: 'ACH',
      fiatPair: 'USD/USD',
      rawFormat: 'Raw Text',
    };
  };

  return (
    <div className="page-enter">
      {/* Mode Selector Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '4px', marginBottom: '20px' }}>
        <button 
          onClick={() => { setMode('cam'); stopScanner(); setError(null); }}
          className="btn"
          style={{ 
            flex: 1, 
            padding: '9px', 
            background: mode === 'cam' ? 'var(--bg)' : 'transparent',
            color: mode === 'cam' ? 'var(--text)' : 'var(--text-secondary)',
            boxShadow: mode === 'cam' ? 'var(--shadow-sm)' : 'none',
            fontSize: '13px',
            justifyContent: 'center'
          }}
        >
          <Ic name="cam" size={15} color={mode === 'cam' ? 'var(--primary)' : 'var(--text-secondary)'} /> Live Camera
        </button>
        
        <button 
          onClick={() => { setMode('up'); stopScanner(); setError(null); }}
          className="btn"
          style={{ 
            flex: 1, 
            padding: '9px', 
            background: mode === 'up' ? 'var(--bg)' : 'transparent',
            color: mode === 'up' ? 'var(--text)' : 'var(--text-secondary)',
            boxShadow: mode === 'up' ? 'var(--shadow-sm)' : 'none',
            fontSize: '13px',
            justifyContent: 'center'
          }}
        >
          <Ic name="up" size={15} color={mode === 'up' ? 'var(--primary)' : 'var(--text-secondary)'} /> Upload Image
        </button>
      </div>

      {/* Live Camera View */}
      {mode === 'cam' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="scan-camera-wrapper" id="qr-reader-target" style={{ position: 'relative' }}>
            {cameraLoading && (
              <div style={{ position: 'absolute', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '30px', height: '30px', border: '3px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: '#fff', fontSize: '13px' }}>Initializing camera...</p>
              </div>
            )}
            
            {scanSuccess && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.9)', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ic name="check" size={32} color="#fff" />
                </div>
                <p style={{ color: '#fff', fontSize: '16px', fontWeight: 800 }}>Scan Successful!</p>
              </div>
            )}

            {!isScanning && !cameraLoading && !scanSuccess && (
              <EmptyState 
                iconName="cam" 
                title="Camera is offline" 
                subtitle="Please allow camera access or check your device settings."
              />
            )}

            {isScanning && (
              <>
                <div className="scanline" />
                <div className="scan-frame-corner scan-corner-tl" />
                <div className="scan-frame-corner scan-corner-tr" />
                <div className="scan-frame-corner scan-corner-bl" />
                <div className="scan-frame-corner scan-corner-br" />
              </>
            )}
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {cameras.length > 0 && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Select Video Device</label>
                <div className="form-input-wrapper">
                  <select 
                    className="form-input" 
                    value={selectedCameraId}
                    onChange={(e) => switchCamera(e.target.value)}
                    style={{ border: 'none', background: 'transparent' }}
                  >
                    {cameras.map(cam => (
                      <option key={cam.id} value={cam.id}>{cam.label || `Camera ${cameras.indexOf(cam) + 1}`}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              {!isScanning ? (
                <button className="btn btn-primary" onClick={initCameras} style={{ flex: 1, padding: '12px 18px' }}>
                  <Ic name="cam" size={16} color="#fff" /> Start Scanner
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={stopScanner} style={{ flex: 1, padding: '12px 18px' }}>
                    Stop Camera
                  </button>
                  {hasFlash && (
                    <button 
                      className={`btn ${flashOn ? 'btn-success' : 'btn-secondary'}`} 
                      onClick={toggleFlash}
                      style={{ padding: '12px' }}
                      title="Toggle Flash"
                    >
                      <Ic name="zap" size={18} color={flashOn ? 'var(--success-dark)' : 'var(--text)'} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Advanced File Upload View */}
      {mode === 'up' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Drag & Drop Upload Zone */}
          <div 
            onClick={() => document.getElementById('qr-file-input').click()}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className="card"
            style={{ 
              cursor: 'pointer', 
              border: dragActive ? '2px solid var(--primary)' : '2px dashed var(--border)', 
              background: dragActive ? 'var(--primary-light)' : 'var(--bg-secondary)',
              transition: 'var(--transition)',
              overflow: 'hidden'
            }}
          >
            <input 
              id="qr-file-input" 
              type="file" 
              accept="image/*"
              onChange={handleFileUpload} 
              style={{ display: 'none' }} 
            />

            <EmptyState
              iconName="up"
              title={dragActive ? "Drop the file here" : "Drag & Drop Image or Paste (Ctrl+V)"}
              subtitle="PNG, JPG, JPEG, or WEBP supported"
            >
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button className="btn btn-secondary btn-sm" type="button">
                  Browse Files
                </button>
                <button 
                  className="btn btn-primary btn-sm" 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); triggerSampleTest(); }}
                >
                  Sample QR Test
                </button>
              </div>
            </EmptyState>
          </div>

          {/* Decoding Spinner */}
          {isDecoding && (
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ width: '28px', height: '28px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
              <p style={{ fontSize: '13px', fontWeight: 700 }}>Processing image filters...</p>
            </div>
          )}

          {/* Success Decoded matrix panel */}
          {decodedTextValue && (
            <div style={{ background: 'var(--success-light)', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Ic name="check" size={16} color="var(--success)" />
                <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--success-dark)', margin: 0 }}>
                  Decoded Content Successfully Extracted!
                </p>
              </div>
              <code style={{ display: 'block', wordBreak: 'break-all', fontSize: '12px', background: 'rgba(255,255,255,0.6)', padding: '6px 10px', borderRadius: '6px', color: 'var(--success-dark)', border: '1px solid rgba(16,185,129,0.15)', fontFamily: 'monospace' }}>
                {decodedTextValue}
              </code>
            </div>
          )}

          {/* Interactive Debug collapsing preview */}
          {imagePreview && (
            <div className="card" style={{ padding: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', marginBottom: '12px' }}>
                🔍 Image Analysis & Debug Previews
              </p>
              
              {/* Image Grid of various pipeline canvases */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>1. Original preview</span>
                  <img src={debugUrls.original || imagePreview} alt="Original" style={{ width: '100%', height: '110px', objectFit: 'contain', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '6px', marginTop: '4px' }} />
                </div>
                
                {debugUrls.binarized && (
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>2. High Contrast</span>
                    <img src={debugUrls.binarized} alt="Binarized" style={{ width: '100%', height: '110px', objectFit: 'contain', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '6px', marginTop: '4px' }} />
                  </div>
                )}
                
                {debugUrls.cropped && (
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>3. Isolated QR</span>
                    <img src={debugUrls.cropped} alt="Cropped" style={{ width: '100%', height: '110px', objectFit: 'contain', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '6px', marginTop: '4px' }} />
                  </div>
                )}
                
                {debugUrls.scaled && (
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>4. 2x Scaled Crop</span>
                    <img src={debugUrls.scaled} alt="Scaled Crop" style={{ width: '100%', height: '110px', objectFit: 'contain', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '6px', marginTop: '4px' }} />
                  </div>
                )}
              </div>

              {/* Console logs output */}
              <details open>
                <summary style={{ fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: 'var(--text-secondary)', outline: 'none' }}>
                  Execution Analysis Logs ({debugLogs.length} steps)
                </summary>
                <div style={{ marginTop: '8px', maxHeight: '150px', overflowY: 'auto', background: '#1e293b', color: '#38bdf8', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {debugLogs.map((log, index) => (
                    <div key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px' }}>
                      {log}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Error Banners */}
      {error && (
        <div style={{ background: 'var(--danger-light)', border: '1px solid #fca5a5', borderRadius: '10px', padding: '14px 16px', marginTop: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--danger-dark)', marginBottom: '4px' }}>
            Scanner Notice
          </p>
          <p style={{ fontSize: '12px', color: 'var(--danger-dark)', margin: 0 }}>
            {error}
          </p>
          {!isScanning && mode === 'cam' && (
            <button className="btn btn-secondary btn-sm" style={{ marginTop: '10px' }} onClick={initCameras}>
              Retry Camera Connection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
