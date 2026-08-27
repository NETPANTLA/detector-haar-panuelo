importScripts('objectdetect.js?v=2', 'objectdetect.frontalface.js?v=1');

const width = 240;
const height = 180;
let detector;
let detectorScale;

function prepareDetector(scaleFactor) {
  if (!detector || detectorScale !== scaleFactor) {
    detector = new objectdetect.detector(width, height, scaleFactor, objectdetect.frontalface);
    detectorScale = scaleFactor;
  }
}

self.addEventListener('message', ({ data }) => {
  if (data.type !== 'detect') return;
  try {
    prepareDetector(data.scaleFactor);
    const faces = detector.detect(data.frame, Math.max(0, data.minNeighbors), 2, undefined, false)
      .filter(face => face[2] >= data.minSize && face[3] >= data.minSize)
      .map(face => ({ x: face[0], y: face[1], width: face[2], height: face[3] }));
    data.frame.close();
    postMessage({ type: 'result', faces });
  } catch (error) {
    try { data.frame.close(); } catch (_) {}
    postMessage({ type: 'error', message: error.message || String(error) });
  }
});

try {
  prepareDetector(1.03);
  postMessage({ type: 'ready' });
} catch (error) {
  postMessage({ type: 'error', message: error.message || String(error) });
}
