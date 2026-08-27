importScripts('opencv.js?v=1');

let detector;

async function waitForOpenCv() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    let candidate = self.cv;
    if (candidate && typeof candidate.then === 'function') {
      candidate = await candidate;
      self.cv = candidate;
    }
    if (candidate && typeof candidate.CascadeClassifier === 'function') return candidate;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('OpenCV.js no terminó de inicializar');
}

async function initialize() {
  try {
    const cv = await waitForOpenCv();
    const response = await fetch('haarcascade_frontalface_default.xml');
    if (!response.ok) throw new Error('No se pudo descargar el clasificador');
    const data = new Uint8Array(await response.arrayBuffer());
    try { cv.FS_createDataFile('/', 'haar.xml', data, true, false, false); } catch (_) {}
    detector = new cv.CascadeClassifier();
    if (!detector.load('haar.xml')) throw new Error('Clasificador no disponible');
    postMessage({ type: 'ready' });
  } catch (error) {
    postMessage({ type: 'error', message: error.message || String(error) });
  }
}

self.addEventListener('message', ({ data }) => {
  if (data.type !== 'detect' || !detector) return;

  let frame;
  let gray;
  let faces;
  try {
    const pixels = new Uint8ClampedArray(data.buffer);
    frame = cv.matFromImageData(new ImageData(pixels, data.width, data.height));
    gray = new cv.Mat();
    faces = new cv.RectVector();
    cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);
    cv.equalizeHist(gray, gray);
    detector.detectMultiScale(
      gray,
      faces,
      data.scaleFactor,
      data.minNeighbors,
      0,
      new cv.Size(data.minSize, data.minSize),
      new cv.Size(0, 0)
    );

    const result = [];
    for (let index = 0; index < faces.size(); index += 1) {
      const face = faces.get(index);
      result.push({ x: face.x, y: face.y, width: face.width, height: face.height });
    }
    postMessage({ type: 'result', faces: result });
  } catch (error) {
    postMessage({ type: 'error', message: error.message || String(error) });
  } finally {
    faces?.delete();
    gray?.delete();
    frame?.delete();
  }
});

initialize();
