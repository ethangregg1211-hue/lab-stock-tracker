let _stream = null;
let _track = null;
let _torchOn = false;

async function startCamera(slotId) {
  const container = document.getElementById('cameraContainer');
  const slot = document.getElementById(slotId);
  if (!slot || !container) return false;

  // If already running in the right slot, do nothing
  if (_stream && container.parentElement === slot) return true;

  // Stop any existing stream before starting a new one
  if (_stream) stopCamera();

  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });

    const video = document.getElementById('scannerVideo');
    video.srcObject = _stream;
    await video.play();

    _track = _stream.getVideoTracks()[0];
    _torchOn = false;
    document.getElementById('flashBtn').style.opacity = '0.6';

    slot.appendChild(container);
    container.classList.remove('hidden');
    return true;
  } catch (err) {
    console.error('Camera error:', err);
    return false;
  }
}

function stopCamera() {
  if (_stream) {
    _stream.getTracks().forEach(t => t.stop());
    _stream = null;
    _track = null;
    _torchOn = false;
  }
  const container = document.getElementById('cameraContainer');
  if (container) {
    document.body.appendChild(container);
    container.classList.add('hidden');
  }
}

function captureFrame() {
  const video = document.getElementById('scannerVideo');
  const canvas = document.getElementById('scannerCanvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

async function toggleTorch() {
  if (!_track) return;
  try {
    const caps = _track.getCapabilities ? _track.getCapabilities() : {};
    if (!caps.torch) return;
    _torchOn = !_torchOn;
    await _track.applyConstraints({ advanced: [{ torch: _torchOn }] });
    document.getElementById('flashBtn').style.opacity = _torchOn ? '1' : '0.6';
  } catch (e) {
    console.warn('Torch unavailable:', e);
  }
}

async function triggerFocus() {
  if (!_track) return;
  try {
    const caps = _track.getCapabilities ? _track.getCapabilities() : {};
    if (caps.focusMode && caps.focusMode.includes('single-shot')) {
      await _track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
    }
  } catch (e) {
    console.warn('Focus unavailable:', e);
  }
}

function isCameraActive() {
  return !!_stream;
}
