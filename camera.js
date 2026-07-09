let stream = null;

async function startCamera() {
  const video = document.getElementById('cameraPreview');

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    video.srcObject = stream;
    video.classList.add('active');
  } catch (err) {
    alert('Camera access denied or unavailable.');
    console.error(err);
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  const video = document.getElementById('cameraPreview');
  video.srcObject = null;
  video.classList.remove('active');
}

function captureFrame() {
  const video = document.getElementById('cameraPreview');
  const canvas = document.getElementById('cameraCanvas');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
}

async function scanAndIdentify() {
  await startCamera();

  return new Promise((resolve) => {
    const scanBtn = document.getElementById('scanBtn');
    const originalText = scanBtn.textContent;

    scanBtn.textContent = 'Capture';
    scanBtn.onclick = async () => {
      const base64 = captureFrame();
      stopCamera();
      scanBtn.textContent = originalText;
      scanBtn.onclick = () => scanAndIdentify().then(resolve);

      try {
        const result = await identifyItemFromImage(base64);
        resolve(result);
      } catch (err) {
        console.error('Identification failed:', err);
        resolve(null);
      }
    };
  });
}
