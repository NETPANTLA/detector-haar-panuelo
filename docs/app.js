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

const analysisCanvas = document.createElement('canvas');
const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });
const worker = new Worker('haar-worker.js?v=1');
const analysisWidth = 320;
const analysisHeight = 240;

let stream;
let animationId;
let running = false;
let workerBusy = false;
let lastProcessedAt = 0;
const processingInterval = 350;

analysisCanvas.width = analysisWidth;
analysisCanvas.height = analysisHeight;

worker.addEventListener('message', ({ data }) => {
  if (data.type === 'ready') {
    cameraButton.disabled = false;
    statusText.textContent = 'Detector preparado. Inicia la cámara.';
    return;
  }

  if (data.type === 'result') {
    workerBusy = false;
    if (running) drawDetections(data.faces);
    return;
  }

  if (data.type === 'error') {
    workerBusy = false;
    statusText.textContent = `Error del detector: ${data.message}`;
  }
});

worker.addEventListener('error', () => {
  workerBusy = false;
  statusText.textContent = 'No se pudo cargar el detector Haar.';
});

function updateLabels() {
  document.querySelector('#scaleValue').value = Number(scale.value).toFixed(2);
  document.querySelector('#neighborsValue').value = neighbors.value;
  document.querySelector('#sizeValue').value = `${minSize.value} px`;
}

[scale, neighbors, minSize].forEach(input => input.addEventListener('input', updateLabels));

sensitiveButton.addEventListener('click', () => {
  scale.value = '1.03';
  neighbors.value = '1';
  minSize.value = '10';
  updateLabels();
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

  if (video.videoWidth && !workerBusy && timestamp - lastProcessedAt >= processingInterval) {
    lastProcessedAt = timestamp;
    analysisContext.drawImage(video, 0, 0, analysisWidth, analysisHeight);
    const image = analysisContext.getImageData(0, 0, analysisWidth, analysisHeight);
    workerBusy = true;
    worker.postMessage({
      type: 'detect',
      width: analysisWidth,
      height: analysisHeight,
      buffer: image.data.buffer,
      scaleFactor: Number(scale.value),
      minNeighbors: Number(neighbors.value),
      minSize: Math.max(5, Math.round(Number(minSize.value) * analysisWidth / 640))
    }, [image.data.buffer]);
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
