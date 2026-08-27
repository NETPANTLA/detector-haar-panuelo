const video = document.querySelector('#video');
const canvas = document.querySelector('#canvas');
const placeholder = document.querySelector('#placeholder');
const cameraButton = document.querySelector('#cameraButton');
const sensitiveButton = document.querySelector('#sensitiveButton');
const statusText = document.querySelector('#status');
const countText = document.querySelector('#count');
const badge = document.querySelector('#liveBadge');
const scale = document.querySelector('#scale');
const neighbors = document.querySelector('#neighbors');
const minSize = document.querySelector('#minSize');
let detector, stream, animationId, running = false;

window.onOpenCvScriptLoaded = async function () {
  try {
    window.cv = window.cv instanceof Promise ? await window.cv : window.cv;
    const data = new Uint8Array(await (await fetch('haarcascade_frontalface_default.xml')).arrayBuffer());
    try { cv.FS_createDataFile('/', 'haar.xml', data, true, false, false); } catch (_) {}
    detector = new cv.CascadeClassifier();
    if (!detector.load('haar.xml')) throw new Error('Clasificador no disponible');
    cameraButton.disabled = false;
    statusText.textContent = 'Detector preparado. Inicia la cámara.';
  } catch (error) { statusText.textContent = `Error: ${error.message}`; }
};

function updateLabels() {
  document.querySelector('#scaleValue').value = Number(scale.value).toFixed(2);
  document.querySelector('#neighborsValue').value = neighbors.value;
  document.querySelector('#sizeValue').value = `${minSize.value} px`;
}
[scale, neighbors, minSize].forEach(input => input.addEventListener('input', updateLabels));

sensitiveButton.addEventListener('click', () => {
  scale.value = '1.03'; neighbors.value = '1'; minSize.value = '10'; updateLabels();
});

cameraButton.addEventListener('click', async () => {
  if (running) return stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'}, audio:false });
    video.srcObject = stream; await video.play();
    running = true; placeholder.hidden = true; badge.textContent = 'EN VIVO'; badge.classList.add('live');
    cameraButton.textContent = 'Detener cámara'; statusText.textContent = 'Analizando video en tiempo real';
    processFrame();
  } catch (_) { statusText.textContent = 'No fue posible abrir la cámara. Revisa el permiso.'; }
});

function processFrame() {
  if (!running || !video.videoWidth) { animationId = requestAnimationFrame(processFrame); return; }
  const width = video.videoWidth, height = video.videoHeight;
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const capture = new cv.VideoCapture(video);
  const frame = new cv.Mat(height,width,cv.CV_8UC4), gray = new cv.Mat(), faces = new cv.RectVector();
  const minimum = new cv.Size(Number(minSize.value),Number(minSize.value)), maximum = new cv.Size(0,0);
  capture.read(frame); cv.cvtColor(frame,gray,cv.COLOR_RGBA2GRAY); cv.equalizeHist(gray,gray);
  detector.detectMultiScale(gray,faces,Number(scale.value),Number(neighbors.value),0,minimum,maximum);
  ctx.drawImage(video,0,0,width,height); ctx.strokeStyle='#34d399'; ctx.fillStyle='#34d399';
  ctx.lineWidth=Math.max(2,width/500); ctx.font=`700 ${Math.max(15,width/55)}px Arial`;
  for(let i=0;i<faces.size();i++){const f=faces.get(i);ctx.strokeRect(f.x,f.y,f.width,f.height);ctx.fillText(String(i+1),f.x+3,Math.max(f.y-5,18));}
  countText.textContent=String(faces.size());
  maximum.delete();minimum.delete();faces.delete();gray.delete();frame.delete();capture.delete();
  animationId=requestAnimationFrame(processFrame);
}

function stopCamera() {
  running=false; cancelAnimationFrame(animationId); stream?.getTracks().forEach(track=>track.stop()); video.srcObject=null;
  placeholder.hidden=false; badge.textContent='EN ESPERA'; badge.classList.remove('live'); cameraButton.textContent='Iniciar cámara';
  countText.textContent='0'; statusText.textContent='Cámara detenida';
}
