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
import { useToast } from '@/components/ui/ToastProvider';
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
  const toast = useToast();

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
  // watchdog timestamps (so the orb never gets stuck) — control path only.
  const connectingSinceRef = useRef(0);
  const lastActivityRef = useRef(0);

  // visualizer refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orbRef = useRef<HTMLButtonElement | null>(null);
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
  // Hide the orb on text-focused chat (it would cover the send/new buttons in
  // the bottom-right corner). Canvas stays mounted so the RAF keeps running.
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
      else if (r.mode === 'graph')
        v._setPanel({
          kind: 'graph', id: msg.id, ts: msg.ts, source: msg.source,
          title: 'Your mind', body: '', sourcePath: null, nodeId: r.nodeId,
        });
      else toast.info(`Couldn’t find “${r.query}”.`);
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
        items: p?.items,
      });
      // add_here / remember confirmations also surface as an unmissable toast.
      if (msg.source === 'tool:remember' && p?.title) toast.success(p.title);
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
    connectingSinceRef.current = Date.now();
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
        lastActivityRef.current = Date.now(); // watchdog: any inbound frame = alive
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

      // --- level plumbing (analyser-driven; idle now visibly breathes) ---
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
      const breath = reduceMotion ? 0.5 : (Math.sin(t * 0.0021) + 1) * 0.5; // slow ~0.33 Hz
      const target =
        st === 'idle' ? 0.26 + 0.16 * breath
          : st === 'connecting' ? 0.24 + 0.2 * breath
            : st === 'thinking' ? 0.42 + 0.16 * breath
              : st === 'error' ? 0.32
                : Math.max(level, 0.12 + 0.08 * breath); // listening / speaking
      smoothRef.current += (target - smoothRef.current) * 0.12;
      const lvl = Math.min(1, smoothRef.current);
      // --- end level plumbing ---

      const [r, g, b] = COLORS[stateRef.current];
      // lighter tint of the state colour for cores / rims / highlights
      const lr = Math.min(255, r + 70), lg = Math.min(255, g + 70), lb = Math.min(255, b + 75);
      // continuous breathing scale + a touch of audio swell — the orb is always alive
      const pulse = reduceMotion ? 1 : 1 + 0.045 * Math.sin(t * 0.0021) + lvl * 0.06;
      const baseR = 50 * pulse;
      const auraR = baseR + 7;

      ctx.save();
      ctx.translate(cx, cy);

      // 1) PULSE RIPPLES — two staggered expanding+fading rings (the live "beat").
      if (!reduceMotion) {
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 2; k++) {
          const phase = (t * 0.00042 + k * 0.5) % 1;
          const rr = baseR + phase * (60 + lvl * 34);
          const a = (1 - phase) * (0.1 + lvl * 0.22);
          if (a < 0.004) continue;
          ctx.beginPath();
          ctx.arc(0, 0, rr, 0, TWO_PI);
          ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // 2) OUTER BLOOM HALO (additive, breathing).
      ctx.globalCompositeOperation = 'lighter';
      const haloOuter = baseR + 50 + lvl * 36;
      const halo = ctx.createRadialGradient(0, 0, baseR * 0.5, 0, 0, haloOuter);
      halo.addColorStop(0, `rgba(${r},${g},${b},${Math.min(0.5, 0.14 + lvl * 0.34)})`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, haloOuter, 0, TWO_PI);
      ctx.fill();

      // 3) FREQUENCY AURA RING (additive) — soft wobble (voice) / breathing (idle).
      const RN = 90;
      const ringRot = reduceMotion ? 0 : t * 0.00016;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < RN; i++) {
        let perBin: number;
        if (an) {
          const bi = Math.floor((i / RN) * 45);
          const b0 = freq[bi] ?? 0;
          const b1 = freq[bi + 1] ?? b0;
          const b2 = freq[(bi + 2) % freq.length] ?? b0;
          perBin = (b0 + b1 + b2) / 3 / 255;
        } else {
          perBin = lvl * 0.5;
        }
        const radius = auraR + perBin * 28 + lvl * 10;
        const ang = (i / RN) * TWO_PI + ringRot;
        pts.push([Math.cos(ang) * radius, Math.sin(ang) * radius]);
      }
      ctx.beginPath();
      ctx.moveTo((pts[RN - 1][0] + pts[0][0]) / 2, (pts[RN - 1][1] + pts[0][1]) / 2);
      for (let i = 0; i < RN; i++) {
        const cur = pts[i];
        const nxt = pts[(i + 1) % RN];
        ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + nxt[0]) / 2, (cur[1] + nxt[1]) / 2);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(0.5, 0.08 + (an ? level : lvl) * 0.4)})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 4) GLASS SPHERE BODY (normal) — translucent, lit top-left, dark base.
      ctx.globalCompositeOperation = 'source-over';
      const body = ctx.createRadialGradient(-baseR * 0.32, -baseR * 0.4, baseR * 0.08, 0, 0, baseR);
      body.addColorStop(0, `rgba(${lr},${lg},${lb},0.95)`);
      body.addColorStop(0.5, `rgba(${r},${g},${b},0.5)`);
      body.addColorStop(1, `rgba(${(r * 0.22) | 0},${(g * 0.22) | 0},${(b * 0.28) | 0},0.92)`);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, baseR, 0, TWO_PI);
      ctx.fill();

      // Fresnel rim — bright glassy edge.
      const rim = ctx.createRadialGradient(0, 0, baseR * 0.74, 0, 0, baseR);
      rim.addColorStop(0, 'rgba(255,255,255,0)');
      rim.addColorStop(1, `rgba(${lr},${lg},${lb},0.55)`);
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(0, 0, baseR, 0, TWO_PI);
      ctx.fill();

      // Clip to the sphere for inner content.
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, baseR, 0, TWO_PI);
      ctx.clip();

      // 5) PULSING INNER CORE — soft breathing energy (the "life").
      ctx.globalCompositeOperation = 'lighter';
      const coreR = baseR * (0.45 + lvl * 0.4);
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
      core.addColorStop(0, `rgba(${lr},${lg},${lb},${0.3 + lvl * 0.45})`);
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, TWO_PI);
      ctx.fill();

      // 6) INTERNAL SWIRLING PARTICLES with z-depth (additive, back-to-front).
      const swirl = st === 'idle' ? 1 : st === 'listening' ? 1.4 : st === 'thinking' ? 2.4 : st === 'speaking' ? 1.9 : 1;
      const a = reduceMotion ? 0 : t * 0.0002;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const projected: Array<{ px: number; py: number; depth: number }> = [];
      for (const p of particlesRef.current) {
        if (!reduceMotion) p.phi += p.speed * swirl;
        const sinPhi = Math.sin(p.phi);
        const cosPhi = Math.cos(p.phi);
        const x3 = p.r * sinPhi * Math.cos(p.theta);
        const y3 = p.r * cosPhi;
        const z3 = p.r * sinPhi * Math.sin(p.theta);
        const px = (x3 * ca + z3 * sa) * baseR * 0.84;
        const py = y3 * baseR * 0.84;
        const depth = -x3 * sa + z3 * ca; // -1..1, +front
        projected.push({ px, py, depth });
      }
      projected.sort((p1, p2) => p1.depth - p2.depth);
      for (const p of projected) {
        const rad = 0.7 + (p.depth + 1) * 1.0;
        const alpha = 0.04 + (p.depth + 1) * 0.1;
        ctx.beginPath();
        ctx.arc(p.px, p.py, rad, 0, TWO_PI);
        ctx.fillStyle = `rgba(${lr},${lg},${lb},${alpha})`;
        ctx.fill();
      }

      ctx.restore(); // release sphere clip

      // 7) SPECULAR HIGHLIGHTS (normal) — bright glassy hotspot + soft secondary.
      ctx.globalCompositeOperation = 'source-over';
      const hx = -baseR * 0.34, hy = -baseR * 0.42;
      const spec = ctx.createRadialGradient(0, 0, 0, 0, 0, baseR * 0.3);
      spec.addColorStop(0, 'rgba(255,255,255,0.9)');
      spec.addColorStop(0.4, 'rgba(255,255,255,0.22)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(-0.6);
      ctx.scale(1, 0.7);
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(0, 0, baseR * 0.3, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
      // secondary reflection, lower-right.
      const sx = baseR * 0.34, sy = baseR * 0.42;
      const spec2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, baseR * 0.24);
      spec2.addColorStop(0, `rgba(${lr},${lg},${lb},0.28)`);
      spec2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spec2;
      ctx.beginPath();
      ctx.arc(sx, sy, baseR * 0.24, 0, TWO_PI);
      ctx.fill();

      // 8) FILM GRAIN (very faint) — pre-baked tile.
      if (grainTile) {
        ctx.globalAlpha = 0.025;
        for (let gx = -baseR; gx < baseR; gx += 64) {
          for (let gy = -baseR; gy < baseR; gy += 64) {
            ctx.drawImage(grainTile, gx, gy);
          }
        }
        ctx.globalAlpha = 1;
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.restore(); // release translate

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    // Watchdog: the orb must never get stuck. If connect hangs, or a reply
    // never finishes (frames stop without onended firing), recover. Control
    // path only — never touches the audio graph / analyser / RAF.
    const watchdog = setInterval(() => {
      if (!runningRef.current) return;
      const now = Date.now();
      const st = stateRef.current;
      if (st === 'connecting' && connectingSinceRef.current && now - connectingSinceRef.current > 12000) {
        setVoiceState('error');
        void stop();
      } else if (
        st === 'speaking' &&
        liveSourcesRef.current.size === 0 &&
        lastActivityRef.current &&
        now - lastActivityRef.current > 1500
      ) {
        setVoiceState('listening');
      }
    }, 1000);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('resize', resize);
      clearInterval(watchdog);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state = v.state;
  const live = state !== 'idle' && state !== 'error';

  // Curly orb — a floating, always-pulsating presence in the bottom-right.
  // Mounted ONCE for the app's whole lifetime so the RAF visualizer + audio
  // graph survive route changes; the canvas is never conditionally unmounted
  // (hideOrb only fades it on /chat). The whole orb is canvas-drawn; the button
  // is a transparent tap target sitting over it.
  return (
    <div
      className={`fixed bottom-5 right-5 z-40 motion-safe:transition-opacity motion-safe:duration-300 ${
        hideOrb ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="relative h-28 w-28">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <button
          ref={orbRef}
          type="button"
          aria-hidden={hideOrb || undefined}
          tabIndex={hideOrb ? -1 : undefined}
          aria-label={live ? 'Stop talking to Curly' : 'Talk to Curly'}
          onClick={() => (runningRef.current ? void stop() : void start())}
          className={`absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full ${
            hideOrb ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
        />
      </div>
    </div>
  );
}
