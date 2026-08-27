'use client';

import { useEffect, useRef, useState } from 'react';

declare global { interface Window { cv?: any } }
const CASCADE = 'haarcascade_frontalface_default.xml';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const cvRef = useRef<any>(null);
  const detectorRef = useRef<any>(null);
  const paramsRef = useRef({ scale: 1.03, neighbors: 1, minSize: 10 });
  const [scale, setScale] = useState(1.03);
  const [neighbors, setNeighbors] = useState(1);
  const [minSize, setMinSize] = useState(10);
  const [count, setCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Cargando el detector Haar…');

  useEffect(() => { paramsRef.current = { scale, neighbors, minSize }; }, [scale, neighbors, minSize]);

  useEffect(() => {
    let cancelled = false;
    async function prepare() {
      if (!window.cv) await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.x/opencv.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar OpenCV.js'));
        document.head.appendChild(script);
      });
      let cv = window.cv;
      if (cv && typeof cv.then === 'function') cv = await cv;
      if (!cv || cancelled) return;
      const bytes = new Uint8Array(await (await fetch(`/${CASCADE}`)).arrayBuffer());
      try { cv.FS_createDataFile('/', CASCADE, bytes, true, false, false); } catch { /* ya cargado */ }
      const detector = new cv.CascadeClassifier();
      if (!detector.load(CASCADE)) throw new Error('No se pudo abrir el clasificador Haar');
      cvRef.current = cv;
      detectorRef.current = detector;
      setStatus('Detector preparado. Inicia la cámara.');
    }
    prepare().catch((error: Error) => setStatus(error.message));
    return () => { cancelled = true; detectorRef.current?.delete(); };
  }, []);

  async function start() {
    const video = videoRef.current;
    if (!video || !cvRef.current || !detectorRef.current) return setStatus('Espera a que cargue el detector.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      setRunning(true);
      setStatus('Analizando video en tiempo real');
      processFrame();
    } catch { setStatus('No fue posible abrir la cámara. Revisa el permiso.'); }
  }

  function processFrame() {
    const cv = cvRef.current, detector = detectorRef.current;
    const video = videoRef.current, canvas = canvasRef.current;
    if (!cv || !detector || !video || !canvas || !video.videoWidth) {
      loopRef.current = requestAnimationFrame(processFrame); return;
    }
    const width = video.videoWidth, height = video.videoHeight;
    video.width = width; video.height = height;
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const capture = new cv.VideoCapture(video);
    const frame = new cv.Mat(height, width, cv.CV_8UC4);
    const gray = new cv.Mat();
    const faces = new cv.RectVector();
    const { scale: sf, neighbors: mn, minSize: ms } = paramsRef.current;
    const minimum = new cv.Size(ms, ms), maximum = new cv.Size(0, 0);
    capture.read(frame);
    cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);
    cv.equalizeHist(gray, gray);
    detector.detectMultiScale(gray, faces, sf, mn, 0, minimum, maximum);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.lineWidth = Math.max(2, width / 500); ctx.strokeStyle = '#34d399';
    ctx.fillStyle = '#34d399'; ctx.font = `700 ${Math.max(15, width / 55)}px Arial`;
    for (let i = 0; i < faces.size(); i += 1) {
      const face = faces.get(i);
      ctx.strokeRect(face.x, face.y, face.width, face.height);
      ctx.fillText(String(i + 1), face.x + 3, Math.max(face.y - 5, 18));
    }
    setCount(faces.size());
    faces.delete(); gray.delete(); frame.delete(); capture.delete();
    loopRef.current = requestAnimationFrame(processFrame);
  }

  function stop() {
    if (loopRef.current !== null) cancelAnimationFrame(loopRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false); setCount(0); setStatus('Cámara detenida');
  }

  return <main className="min-h-screen bg-[#07110d] text-[#f4f7f5]">
    <header className="border-b border-white/10 px-5 py-5 sm:px-10">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-400">Laboratorio textil adversarial</p><h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Detector Haar · Pañuelo</h1></div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${running ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-white/60'}`}>{running ? 'EN VIVO' : 'EN ESPERA'}</span>
      </div>
    </header>
    <section className="mx-auto grid max-w-7xl gap-6 px-5 py-7 lg:grid-cols-[minmax(0,1fr)_330px] lg:px-10">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">
        <div className="relative aspect-video">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />
          {!running && <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,#123d2c,#07110d_65%)]"><div className="max-w-sm px-6 text-center"><div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full border border-emerald-300/30 bg-emerald-400/10 text-3xl">◉</div><h2 className="text-xl font-semibold">Prueba el patrón frente a la cámara</h2><p className="mt-2 text-sm leading-6 text-white/55">Los recuadros verdes son candidatos faciales, no identidades.</p></div></div>}
          <div className="absolute left-4 top-4 rounded-xl border border-white/10 bg-black/70 px-4 py-2"><span className="text-xs uppercase text-white/50">Candidatos</span><strong className="ml-3 text-2xl text-emerald-400">{count}</strong></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4"><p className="text-sm text-white/55" aria-live="polite">{status}</p><button onClick={running ? stop : start} className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-emerald-950 hover:bg-emerald-300">{running ? 'Detener cámara' : 'Iniciar cámara'}</button></div>
      </div>
      <aside className="rounded-3xl border border-white/10 bg-white/[.045] p-6">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-400">Sensibilidad</p><h2 className="mt-2 text-xl font-semibold">Ajustes en tiempo real</h2><p className="mt-2 text-sm leading-6 text-white/50">Más sensibilidad encuentra más patrones y también más falsos positivos.</p>
        <div className="mt-7 space-y-7">
          <Control label="Factor de escala" value={scale.toFixed(2)} note="Más cerca de 1 revisa más tamaños."><input aria-label="Factor de escala" type="range" min="1.01" max="1.30" step="0.01" value={scale} onChange={e => setScale(Number(e.target.value))}/></Control>
          <Control label="Confirmaciones" value={String(neighbors)} note="Menor valor produce más candidatos."><input aria-label="Confirmaciones" type="range" min="0" max="10" step="1" value={neighbors} onChange={e => setNeighbors(Number(e.target.value))}/></Control>
          <Control label="Tamaño mínimo" value={`${minSize} px`} note="Incluye patrones más pequeños."><input aria-label="Tamaño mínimo" type="range" min="5" max="100" step="5" value={minSize} onChange={e => setMinSize(Number(e.target.value))}/></Control>
        </div>
        <button onClick={() => { setScale(1.03); setNeighbors(1); setMinSize(10); }} className="mt-8 w-full rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/75 hover:border-emerald-400/50">Modo alta sensibilidad</button>
      </aside>
    </section>
  </main>;
}

function Control({ label, value, note, children }: { label: string; value: string; note: string; children: React.ReactNode }) {
  return <label className="block"><span className="flex justify-between text-sm font-semibold"><span>{label}</span><output className="font-mono text-emerald-300">{value}</output></span><span className="mt-3 block">{children}</span><span className="mt-2 block text-xs text-white/40">{note}</span></label>;
}
