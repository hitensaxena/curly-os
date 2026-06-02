'use client';

// Curly's persistent presence in the OS — mounted once in the root layout so its
// WebSocket, audio graph, and visualizer survive route changes.
//
// Faithful React port of curly-voice/web/client.ts: mic capture (AudioWorklet,
// 16kHz PCM16) -> WS binary; Nova's 24kHz PCM -> scheduled playback with barge-in;
// an audio-reactive canvas aura; and the UI-intent reducer that feeds the Stage.
// All browser APIs live inside handlers/effects (SSR-safe); every resource is torn
// down on unmount; start() runs only from the user-gesture tap (autoplay policy).
import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { GraphPayload, NavPayload, ShowPayload, UIFrame, VoiceState } from './stage/types';
import { resolveTarget } from '@/lib/stage-targets';
import { useVoice, type VoiceHere } from '@/lib/voice/VoiceContext';
import { VOICE_COLORS as COLORS } from '@/lib/voice/colors';

const CAPTURE_RATE = 16000;
const PLAYBACK_RATE = 24000;
const SEND_SAMPLES = 512;

function wsUrl(): string {
  const env = process.env.NEXT_PUBLIC_VOICE_WS_URL;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

export function CurlyOrb() {
  const v = useVoice();

  // refs (hot-path / long-lived — never trigger renders)
  const stateRef = useRef<VoiceState>('idle');
  const hereRef = useRef<VoiceHere | null>(null);
  const mountedRef = useRef(true);
  const runningRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const capCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const playAnalyserRef = useRef<AnalyserNode | null>(null);
  const nextTimeRef = useRef(0);
  const liveSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const accRef = useRef<Int16Array>(new Int16Array(0));
  const endedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // visualizer refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orbRef = useRef<HTMLButtonElement | null>(null);
  const sheenRef = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothRef = useRef(0);
  const freqRef = useRef(new Uint8Array(128));
  // Spherical "stars suspended in glass": theta/phi place each point on a sphere,
  // r is its depth from center (0..1), phi advances per-frame by a state-driven swirl.
  const particlesRef = useRef(
    Array.from({ length: 70 }, () => ({
      theta: Math.random() * Math.PI * 2,
      phi: Math.acos(2 * Math.random() - 1),
      r: 0.2 + Math.random() * 0.8,
      speed: 0.0006 + Math.random() * 0.0014,
    })),
  );

  const router = useRouter();
  const pathname = usePathname();
  const hideOrb = !!pathname && pathname.startsWith('/chat');

  function setVoiceState(s: VoiceState) {
    stateRef.current = s; // hot-path: RAF visualizer reads this, never React state
    if (mountedRef.current) v._setState(s);
    if (typeof document !== 'undefined') {
      const [r, g, b] = COLORS[s];
      // Drive only the voice-reactive token — NEVER the global brand --accent.
      document.documentElement.style.setProperty('--voice-rgb', `${r},${g},${b}`);
    }
  }

  // Send the user's current screen to the voice backend (context-awareness).
  function sendContext(here: VoiceHere) {
    hereRef.current = here;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'context', route: here.route, title: here.title }));
      } catch {
        /* socket closing */
      }
    }
  }

  // ---------- playback ----------
  function playPCM(int16: Int16Array) {
    const ctx = playCtxRef.current;
    const gain = masterGainRef.current;
    if (!ctx || !gain) return;
    const f32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f32[i] = (int16[i] ?? 0) / 0x8000;
    const buf = ctx.createBuffer(1, f32.length, PLAYBACK_RATE);
    buf.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    const now = ctx.currentTime;
    if (nextTimeRef.current < now) nextTimeRef.current = now + 0.03;
    src.start(nextTimeRef.current);
    nextTimeRef.current += buf.duration;
    liveSourcesRef.current.add(src);
    src.onended = () => {
      liveSourcesRef.current.delete(src);
      if (liveSourcesRef.current.size === 0) {
        if (endedTimeoutRef.current) clearTimeout(endedTimeoutRef.current);
        endedTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && liveSourcesRef.current.size === 0 && stateRef.current === 'speaking') setVoiceState('listening');
        }, 220);
      }
    };
    if (stateRef.current !== 'speaking') setVoiceState('speaking');
  }

  function flushPlayback() {
    for (const s of liveSourcesRef.current) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    liveSourcesRef.current.clear();
    nextTimeRef.current = 0;
  }

  // ---------- UI intents ----------
  // Navigation drives the REAL OS (router.push); transient content (recall / web /
  // think / a graph) lands in the integrated Curly panel via context.
  function handleUI(msg: UIFrame) {
    if (msg.intent === 'clear') {
      v._setPanel(null);
      return;
    }
    if (msg.intent === 'graph') {
      const g = msg.payload as GraphPayload;
      v._setPanel({
        kind: 'graph', id: msg.id, ts: msg.ts, source: msg.source,
        title: g?.title ?? 'Your mind', body: '', sourcePath: null, nodeId: g?.nodeId ?? null,
      });
      return;
    }
    if (msg.intent === 'navigate') {
      const target = (msg.payload as NavPayload)?.target ?? '';
      const r = resolveTarget(target);
      if (r.mode === 'route') router.push(r.href);
      else
        v._setPanel({
          kind: 'graph', id: msg.id, ts: msg.ts, source: msg.source,
          title: 'Your mind', body: '', sourcePath: null, nodeId: r.nodeId,
        });
      return;
    }
    if (msg.intent === 'show') {
      const p = msg.payload as ShowPayload;
      v._setPanel({
        kind: p?.kind ?? 'note',
        id: msg.id,
        ts: msg.ts,
        source: msg.source,
        title: p?.title ?? '',
        body: p?.body ?? '',
        sourcePath: p?.sourcePath ?? null,
      });
    }
  }

  function handleControl(msg: any) {
    switch (msg?.type) {
      case 'ready':
        setVoiceState('listening');
        break;
      case 'transcript':
        if (mountedRef.current) v._setCaption(String(msg.text ?? ''));
        if (msg.role === 'user') setVoiceState('thinking');
        break;
      case 'interrupt':
        flushPlayback();
        setVoiceState('listening');
        break;
      case 'closed':
        if (stateRef.current !== 'idle') setVoiceState('listening');
        break;
      case 'error':
        setVoiceState('error');
        break;
    }
  }

  // ---------- start / stop ----------
  async function start() {
    if (runningRef.current) return;
    runningRef.current = true;
    setVoiceState('connecting');
    try {
      const playCtx = new AudioContext({ sampleRate: PLAYBACK_RATE });
      await playCtx.resume();
      playCtxRef.current = playCtx;
      const masterGain = playCtx.createGain();
      const playAnalyser = playCtx.createAnalyser();
      playAnalyser.fftSize = 256;
      playAnalyser.smoothingTimeConstant = 0.75;
      masterGain.connect(playAnalyser);
      playAnalyser.connect(playCtx.destination);
      masterGainRef.current = masterGain;
      playAnalyserRef.current = playAnalyser;

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micStreamRef.current = micStream;
      const capCtx = new AudioContext({ sampleRate: CAPTURE_RATE });
      await capCtx.audioWorklet.addModule('/pcm-worklet.js');
      capCtxRef.current = capCtx;
      const source = capCtx.createMediaStreamSource(micStream);
      const micAnalyser = capCtx.createAnalyser();
      micAnalyser.fftSize = 256;
      micAnalyser.smoothingTimeConstant = 0.8;
      source.connect(micAnalyser);
      micAnalyserRef.current = micAnalyser;
      const node = new AudioWorkletNode(capCtx, 'pcm-capture');
      const mute = capCtx.createGain();
      mute.gain.value = 0;
      source.connect(node).connect(mute).connect(capCtx.destination);

      const ws = new WebSocket(wsUrl());
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'start' }));
        if (hereRef.current) sendContext(hereRef.current);
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          let msg: any;
          try {
            msg = JSON.parse(ev.data);
          } catch {
            return;
          }
          if (msg?.type === 'ui') handleUI(msg as UIFrame);
          else handleControl(msg);
        } else {
          playPCM(new Int16Array(ev.data as ArrayBuffer));
        }
      };
      ws.onclose = () => stop();
      ws.onerror = () => setVoiceState('error');

      accRef.current = new Int16Array(0);
      node.port.onmessage = (e: MessageEvent) => {
        const frame = new Int16Array(e.data as ArrayBuffer);
        const merged = new Int16Array(accRef.current.length + frame.length);
        merged.set(accRef.current);
        merged.set(frame, accRef.current.length);
        accRef.current = merged;
        while (accRef.current.length >= SEND_SAMPLES) {
          const chunk = accRef.current.slice(0, SEND_SAMPLES);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(chunk.buffer);
          accRef.current = accRef.current.slice(SEND_SAMPLES);
        }
      };
    } catch (err) {
      console.error('[curly-orb] start failed', err);
      setVoiceState('error');
      await stop();
    }
  }

  async function stop() {
    runningRef.current = false;
    flushPlayback();
    if (endedTimeoutRef.current) {
      clearTimeout(endedTimeoutRef.current);
      endedTimeoutRef.current = null;
    }
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* noop */
      }
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    try {
      await capCtxRef.current?.close();
    } catch {
      /* noop */
    }
    try {
      await playCtxRef.current?.close();
    } catch {
      /* noop */
    }
    capCtxRef.current = playCtxRef.current = null;
    micAnalyserRef.current = playAnalyserRef.current = masterGainRef.current = null;
    if (mountedRef.current && stateRef.current !== 'error') setVoiceState('idle');
  }

  // ---------- visualizer (runs whole lifetime; reads refs only) ----------
  useEffect(() => {
    mountedRef.current = true;
    // Expose imperative controls so the dock/pages and RouteBeacon can drive the
    // orb (start/stop) and push screen context — without a second WebSocket.
    v.registerControls({ start, stop, sendContext });
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const SIZE = 320;

    // Read motion preference once for the effect's lifetime (mirrors AnimatedLogo).
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Pre-bake a 64x64 gray-noise tile ONCE; reused every frame for faint film grain.
    let grainTile: HTMLCanvasElement | null = null;
    if (typeof document !== 'undefined') {
      const g = document.createElement('canvas');
      g.width = g.height = 64;
      const gctx = g.getContext('2d');
      if (gctx) {
        const img = gctx.createImageData(64, 64);
        for (let i = 0; i < img.data.length; i += 4) {
          const n = (Math.random() * 255) | 0;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
          img.data[i + 3] = 255;
        }
        gctx.putImageData(img, 0, 0);
        grainTile = g;
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = SIZE * dpr;
      canvas!.height = SIZE * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const TWO_PI = Math.PI * 2;

    const draw = (t: number) => {
      const cx = SIZE / 2;
      const cy = SIZE / 2;
      ctx.clearRect(0, 0, SIZE, SIZE);

      // --- level plumbing (kept verbatim from the prior implementation) ---
      const st = stateRef.current;
      const an = st === 'speaking' ? playAnalyserRef.current : st === 'listening' || st === 'thinking' ? micAnalyserRef.current : null;
      let level = 0;
      const freq = freqRef.current;
      if (an) {
        an.getByteFrequencyData(freq);
        let sum = 0;
        for (let i = 0; i < 40; i++) sum += freq[i] ?? 0;
        level = sum / 40 / 255;
      }
      const breathe = reduceMotion ? 0.5 : (Math.sin(t * 0.0016) + 1) * 0.5;
      const target = st === 'idle' ? 0.05 * breathe : st === 'thinking' ? 0.12 + 0.1 * breathe : level;
      smoothRef.current += (target - smoothRef.current) * 0.18;
      const lvl = smoothRef.current;
      // --- end level plumbing ---

      const [r, g, b] = COLORS[stateRef.current];
      const baseR = 66;
      const auraR = baseR + 6;

      ctx.save();
      ctx.translate(cx, cy);

      // 1) OUTER BLOOM HALO (additive)
      ctx.globalCompositeOperation = 'lighter';
      const haloOuter = baseR + 70 + lvl * 60;
      const halo = ctx.createRadialGradient(0, 0, baseR * 0.6, 0, 0, haloOuter);
      halo.addColorStop(0, `rgba(${r},${g},${b},${Math.min(0.42, 0.1 + lvl * 0.28)})`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, haloOuter, 0, TWO_PI);
      ctx.fill();

      // 2) FREQUENCY AURA RING (additive) — one smooth closed path, soft wobble.
      const RN = 96;
      const ringRot = reduceMotion ? 0 : t * 0.00018;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < RN; i++) {
        let perBin: number;
        if (an) {
          // rolling average of 3 neighbouring bins -> wobble, not spikes
          const bi = Math.floor((i / RN) * 45);
          const b0 = freq[bi] ?? 0;
          const b1 = freq[bi + 1] ?? b0;
          const b2 = freq[(bi + 2) % freq.length] ?? b0;
          perBin = (b0 + b1 + b2) / 3 / 255;
        } else {
          perBin = lvl;
        }
        const radius = auraR + perBin * 40 + lvl * 22;
        const ang = (i / RN) * TWO_PI + ringRot;
        pts.push([Math.cos(ang) * radius, Math.sin(ang) * radius]);
      }
      // Smooth via midpoint quadratic curves through the points.
      ctx.beginPath();
      const mid0x = (pts[RN - 1][0] + pts[0][0]) / 2;
      const mid0y = (pts[RN - 1][1] + pts[0][1]) / 2;
      ctx.moveTo(mid0x, mid0y);
      for (let i = 0; i < RN; i++) {
        const cur = pts[i];
        const nxt = pts[(i + 1) % RN];
        const mx = (cur[0] + nxt[0]) / 2;
        const my = (cur[1] + nxt[1]) / 2;
        ctx.quadraticCurveTo(cur[0], cur[1], mx, my);
      }
      ctx.closePath();
      const ringFill = ctx.createRadialGradient(0, 0, baseR, 0, 0, auraR + 50);
      ringFill.addColorStop(0, `rgba(${r},${g},${b},${Math.min(0.18, 0.04 + lvl * 0.14)})`);
      ringFill.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ringFill;
      ctx.fill();
      ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(0.6, 0.1 + level * 0.5)})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 3) GLASS SPHERE BODY (normal compositing) — lit off-center top-left.
      ctx.globalCompositeOperation = 'source-over';
      const body = ctx.createRadialGradient(-18, -24, 2, 0, 0, baseR);
      body.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
      body.addColorStop(1, `rgba(${r},${g},${b},0.1)`);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, baseR, 0, TWO_PI);
      ctx.fill();
      // subtle rim-light: faint white brightening near the edge.
      const rim = ctx.createRadialGradient(0, 0, baseR * 0.82, 0, 0, baseR);
      rim.addColorStop(0, 'rgba(255,255,255,0)');
      rim.addColorStop(1, 'rgba(255,255,255,0.06)');
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(0, 0, baseR, 0, TWO_PI);
      ctx.fill();

      // Clip to the sphere so internal particles stay inside the glass.
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, baseR, 0, TWO_PI);
      ctx.clip();

      // 4) INTERNAL SWIRLING PARTICLES with z-depth (additive, back-to-front).
      const swirl = st === 'idle' ? 1 : st === 'listening' ? 1.4 : st === 'thinking' ? 2.2 : st === 'speaking' ? 1.8 : 1;
      const a = reduceMotion ? 0 : t * 0.0002;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const projected: Array<{ px: number; py: number; depth: number }> = [];
      for (const p of particlesRef.current) {
        if (!reduceMotion) p.phi += p.speed * swirl;
        const sinPhi = Math.sin(p.phi);
        const cosPhi = Math.cos(p.phi);
        const cosTheta = Math.cos(p.theta);
        const sinTheta = Math.sin(p.theta);
        const x3 = p.r * sinPhi * cosTheta;
        const y3 = p.r * cosPhi;
        const z3 = p.r * sinPhi * sinTheta;
        const px = (x3 * ca + z3 * sa) * baseR * 0.86;
        const py = y3 * baseR * 0.86;
        const depth = -x3 * sa + z3 * ca; // -1..1, +front
        projected.push({ px, py, depth });
      }
      projected.sort((p1, p2) => p1.depth - p2.depth);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of projected) {
        const rad = 0.8 + (p.depth + 1) * 1.1;
        const alpha = 0.05 + (p.depth + 1) * 0.12;
        ctx.beginPath();
        ctx.arc(p.px, p.py, rad, 0, TWO_PI);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
      }

      // 5) SPECULAR HIGHLIGHT (normal) — the glassy read, top-left.
      ctx.globalCompositeOperation = 'source-over';
      const hx = -baseR * 0.35;
      const hy = -baseR * 0.4;
      const spec = ctx.createRadialGradient(hx, hy, 0, hx, hy, baseR * 0.4);
      spec.addColorStop(0, 'rgba(255,255,255,0.5)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(hx, hy, baseR * 0.4, 0, TWO_PI);
      ctx.fill();

      ctx.restore(); // release sphere clip

      // 6) FILM GRAIN (very faint) — pre-baked tile, tiled across the orb area.
      if (grainTile) {
        ctx.globalAlpha = 0.03;
        for (let gx = -baseR; gx < baseR; gx += 64) {
          for (let gy = -baseR; gy < baseR; gy += 64) {
            ctx.drawImage(grainTile, gx, gy);
          }
        }
        ctx.globalAlpha = 1;
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.restore(); // release translate

      if (orbRef.current) orbRef.current.style.transform = `translate(-50%, -50%) scale(${1 + lvl * 0.12})`;
      if (sheenRef.current) sheenRef.current.style.opacity = String(0.3 + lvl * 0.6);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state = v.state;
  const caption = v.caption;
  const live = state !== 'idle' && state !== 'error';

  return (
    <>
      {caption && !hideOrb && (
        <div className="pointer-events-none fixed inset-x-0 bottom-56 z-30 mx-auto max-w-[640px] px-6 text-center text-sm text-subtle">
          {caption}
        </div>
      )}

      {/* orb + local audio-reactive canvas, bottom-center, persistent across routes.
          On /chat the wrapper is made visually gone + non-interactive, but the canvas
          and button STAY MOUNTED so the visualizer RAF (started once on mount) keeps
          running — leaving /chat restores the orb instantly. */}
      <div
        className={`pointer-events-none fixed bottom-4 left-1/2 z-40 h-[320px] w-[320px] -translate-x-1/2 motion-safe:transition-opacity motion-safe:duration-300 ${
          hideOrb ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ width: 320, height: 320 }} />
        <button
          ref={orbRef}
          type="button"
          aria-hidden={hideOrb || undefined}
          tabIndex={hideOrb ? -1 : undefined}
          aria-label={live ? 'Stop talking to Curly' : 'Talk to Curly'}
          onClick={() => (runningRef.current ? void stop() : void start())}
          className={`absolute left-1/2 top-1/2 grid h-[120px] w-[120px] place-items-center rounded-full ${
            hideOrb ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
          style={{ transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle at 50% 36%, var(--surface-3), var(--surface) 72%)', boxShadow: '0 0 0 1px var(--border)' }}
        >
          <span
            ref={sheenRef}
            className="pointer-events-none absolute rounded-full"
            style={{ inset: '16%', background: 'radial-gradient(circle at 50% 42%, rgb(var(--voice-rgb)), transparent 70%)', filter: 'blur(10px)', opacity: 0.3 }}
          />
          <span className="relative z-10 text-[10px] uppercase tracking-[0.18em]" style={{ color: live ? 'rgb(var(--voice-rgb))' : 'var(--muted)' }}>
            {state === 'idle' ? 'talk' : state}
          </span>
        </button>
      </div>
    </>
  );
}
