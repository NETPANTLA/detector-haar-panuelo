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

const analysisWidth = 240;
const analysisHeight = 180;
const processingInterval = 350;
const worker = new Worker('haar-worker.js?v=4');

let stream;
let animationId;
let running = false;
let workerBusy = false;
let lastProcessedAt = 0;

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
  statusText.textContent = 'No se pudo iniciar el detector Haar.';
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
  if (running) return stopCamera();
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
    workerBusy = true;
    clearDetections();
    createImageBitmap(video)
      .then(frame => worker.postMessage({
        type: 'detect',
        frame,
        scaleFactor: Number(scale.value),
        minNeighbors: Number(neighbors.value),
        minSize: Math.max(4, Math.round(Number(minSize.value) * analysisWidth / 640))
      }, [frame]))
      .catch(() => { workerBusy = false; });
  }
  animationId = requestAnimationFrame(processFrame);
}

function clearDetections() {
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  countText.textContent = '0';
}

function drawDetections(faces) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const scaleX = width / analysisWidth;
  const scaleY = height / analysisHeight;
  context.strokeStyle = '#e53935';
  context.lineWidth = Math.max(2, width / 500);
  faces.forEach(face => context.strokeRect(
    face.x * scaleX, face.y * scaleY, face.width * scaleX, face.height * scaleY
  ));
  countText.textContent = String(faces.length);
}

function stopCamera() {
  running = false;
  cancelAnimationFrame(animationId);
  stream?.getTracks().forEach(track => track.stop());
  video.srcObject = null;
  placeholder.hidden = false;
  cameraButton.textContent = 'Iniciar cámara';
  clearDetections();
  statusText.textContent = 'Cámara detenida';
}
