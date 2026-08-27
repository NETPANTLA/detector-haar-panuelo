const video = document.querySelector('#video');
const canvas = document.querySelector('#canvas');
const placeholder = document.querySelector('#placeholder');
const cameraButton = document.querySelector('#cameraButton');
const sensitiveButton = document.querySelector('#sensitiveButton');
const statusText = document.querySelector('#status');
const countText = document.querySelector('#count');
const scale = document.querySelector('#scale');
const neighbors = document.querySelector('#neighbors');
const minSize = document.querySelector('#minSize');

const analysisWidth = 320;
const analysisHeight = 240;
const processingInterval = 350;

let detector;
let detectorScale;
let stream;
let animationId;
let running = false;
let lastProcessedAt = 0;

function prepareDetector() {
  const selectedScale = Number(scale.value);
  if (!detector || detectorScale !== selectedScale) {
    detector = new objectdetect.detector(
      analysisWidth,
      analysisHeight,
      selectedScale,
      objectdetect.frontalface
    );
    detectorScale = selectedScale;
  }
}

try {
  prepareDetector();
  cameraButton.disabled = false;
  statusText.textContent = 'Detector preparado. Inicia la cámara.';
} catch (error) {
  statusText.textContent = `No se pudo preparar el detector: ${error.message || error}`;
}

function updateLabels() {
  document.querySelector('#scaleValue').value = Number(scale.value).toFixed(2);
  document.querySelector('#neighborsValue').value = neighbors.value;
  document.querySelector('#sizeValue').value = `${minSize.value} px`;
}

[scale, neighbors, minSize].forEach(input => input.addEventListener('input', updateLabels));
scale.addEventListener('change', prepareDetector);

sensitiveButton.addEventListener('click', () => {
  scale.value = '1.03';
  neighbors.value = '1';
  minSize.value = '10';
  updateLabels();
  prepareDetector();
});

cameraButton.addEventListener('click', async () => {
  if (running) {
    stopCamera();
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    running = true;
    placeholder.hidden = true;
    lastProcessedAt = 0;
    cameraButton.textContent = 'Detener cámara';
    statusText.textContent = 'Analizando video en tiempo real';
    animationId = requestAnimationFrame(processFrame);
  } catch (error) {
    statusText.textContent = error.name === 'NotAllowedError'
      ? 'Permiso de cámara rechazado. Habilítalo en el navegador.'
      : `No fue posible iniciar la cámara: ${error.message || error.name}`;
  }
});

function processFrame(timestamp = 0) {
  if (!running) return;

  if (video.videoWidth && timestamp - lastProcessedAt >= processingInterval) {
    lastProcessedAt = timestamp;
    try {
      prepareDetector();
      const grouped = Math.max(0, Number(neighbors.value));
      const minimum = Number(minSize.value) * analysisWidth / 640;
      const detections = detector.detect(video, grouped, 2, undefined, false)
        .filter(face => face[2] >= minimum && face[3] >= minimum)
        .map(face => ({ x: face[0], y: face[1], width: face[2], height: face[3] }));
      drawDetections(detections);
    } catch (error) {
      statusText.textContent = `Error del detector: ${error.message || error}`;
    }
  }

  animationId = requestAnimationFrame(processFrame);
}

function drawDetections(faces) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const scaleX = width / analysisWidth;
  const scaleY = height / analysisHeight;

  context.clearRect(0, 0, width, height);
  context.strokeStyle = '#e53935';
  context.fillStyle = '#e53935';
  context.lineWidth = Math.max(2, width / 500);
  context.font = `700 ${Math.max(15, width / 55)}px Arial`;

  faces.forEach((face, index) => {
    const x = face.x * scaleX;
    const y = face.y * scaleY;
    context.strokeRect(x, y, face.width * scaleX, face.height * scaleY);
    context.fillText(String(index + 1), x + 3, Math.max(y - 5, 18));
  });
  countText.textContent = String(faces.length);
}

function stopCamera() {
  running = false;
  cancelAnimationFrame(animationId);
  stream?.getTracks().forEach(track => track.stop());
  video.srcObject = null;
  placeholder.hidden = false;
  cameraButton.textContent = 'Iniciar cámara';
  countText.textContent = '0';
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  statusText.textContent = 'Cámara detenida';
}
