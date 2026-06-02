// Mintrix "Bloom" mark — the spiral the agent draws as it works.
//
// Geometry and motion vocabulary extracted from the Mintrix logo bundle
// (Bloom v11). Four of the eleven canonical states are surfaced here —
// the ones this app needs:
//
//   idle      — ambient breathing (default)
//   loading   — orbiting spinner (route loader)
//   thinking  — cogitation cloud (chat streaming, capture routing)
//   success   — quiet commit (save confirmation flash)
//
// Geometry is locked: viewBox 0 0 240 240, centre (120, 120), one
// Archimedean spiral drawn outward from centre, three render tiers
// chosen by pixel size.

const INK = "currentColor";
const ERROR = "var(--danger, #DC2626)";
const SUCCESS = "var(--success, #16A34A)";
const CX = 120;
const CY = 120;
const W_A = 6;
const W_B = 9.8 / (2 * Math.PI);
const W_STEPS = 260;

type SpiralPath = {
  d: string;
  pts: [number, number][];
  total: number;
  pointAt(t: number): [number, number];
};

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function houseEase(t: number): number {
  return 1 - Math.pow(1 - clamp01(t), 4);
}

function outSoft(t: number): number {
  return 1 - Math.pow(1 - clamp01(t), 3.2);
}

function stepPrecise(t: number): number {
  t = clamp01(t);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function errorTap(t: number): number {
  t = clamp01(t);
  return t < 0.5 ? 2.5 * t * t : 1 - Math.pow(-2 * t + 2, 1.8) / 2;
}

function breath(t: number): number {
  return 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
}

function overshoot(t: number, k = 1.7): number {
  t = clamp01(t) - 1;
  return t * t * ((k + 1) * t + k) + 1;
}

function buildSpiralPath(turns: number, steps: number, scale = 1): SpiralPath {
  const pts: [number, number][] = [];
  const a0 = W_A * scale;
  const b0 = W_B * scale;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * turns * 2 * Math.PI;
    const r = a0 + b0 * theta;
    const a = -Math.PI / 2 + theta;
    pts.push([CX + r * Math.cos(a), CY + r * Math.sin(a)]);
  }
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`;
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  function pointAt(t: number): [number, number] {
    const target = clamp01(t) * total;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid;
      else hi = mid;
    }
    const span = cum[hi] - cum[lo] || 1;
    const f = (target - cum[lo]) / span;
    return [
      pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f,
      pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f,
    ];
  }
  return { d, pts, total, pointAt };
}

const SPIRAL_HERO = buildSpiralPath(3.5, W_STEPS, 1.0);
const SPIRAL_MID = buildSpiralPath(3.0, 220, 1.5);
const SPIRAL_TINY = buildSpiralPath(2.25, 180, 3.5);

const PARTICLE_COUNT = 21;
type Particle = { t: number; r: number };
const PARTICLES: Particle[] = [];
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const t = (i + 0.5) / PARTICLE_COUNT;
  PARTICLES.push({ t, r: 0.8 + Math.abs(Math.sin(i * 7.3)) * 0.8 });
}

type Tier = {
  name: "hero" | "mid" | "tiny";
  spiral: SpiralPath;
  activeSw: number;
  activeOp: number;
  showParticles: boolean;
  particleOpBase: number;
};

const TIERS: Record<Tier["name"], Tier> = {
  hero: {
    name: "hero",
    spiral: SPIRAL_HERO,
    activeSw: 1.1,
    activeOp: 0.65,
    showParticles: true,
    particleOpBase: 0.45,
  },
  mid: {
    name: "mid",
    spiral: SPIRAL_MID,
    activeSw: 1.5,
    activeOp: 0.78,
    showParticles: true,
    particleOpBase: 0.3,
  },
  tiny: {
    name: "tiny",
    spiral: SPIRAL_TINY,
    activeSw: 2.4,
    activeOp: 0.92,
    showParticles: false,
    particleOpBase: 0,
  },
};

export function tierFor(sizePx: number): Tier {
  if (sizePx >= 120) return TIERS.hero;
  if (sizePx >= 48) return TIERS.mid;
  return TIERS.tiny;
}

type RenderOpts = {
  tier: Tier;
  spiralColor?: string;
  spiralOp?: number;
  spiralSw?: number;
  /** Stroke-dashoffset to support draw-in: 0 = fully drawn, tier.spiral.total = invisible. */
  spiralDashOff?: number;
  showBindu?: boolean;
  binduAt?: [number, number];
  binduScale?: number;
  binduOp?: number;
  binduColor?: string;
  binduR?: number;
  particleColor?: (i: number) => string;
  particleScale?: (i: number) => number;
  particleOp?: (i: number) => number;
  extras?: string;
};

function renderHTML(opts: RenderOpts): string {
  const { tier } = opts;
  const sp = tier.spiral;
  const spiralColor = opts.spiralColor ?? INK;
  const spiralOp = opts.spiralOp ?? tier.activeOp;
  const spiralSw = opts.spiralSw ?? tier.activeSw;
  const dashAttrs =
    opts.spiralDashOff !== undefined
      ? ` stroke-dasharray="${sp.total.toFixed(1)}" stroke-dashoffset="${opts.spiralDashOff.toFixed(1)}"`
      : "";
  const showParticles = tier.showParticles;
  const particleOpBase = tier.particleOpBase;
  const showBindu = opts.showBindu ?? false;
  const binduAt = opts.binduAt ?? [CX, CY];
  const binduScale = opts.binduScale ?? 1;
  const binduOp = opts.binduOp ?? 1;
  const binduColor = opts.binduColor ?? INK;
  const binduR = opts.binduR ?? 5;

  let s = "<g>";
  s += `<path d="${sp.d}" stroke="${spiralColor}" stroke-width="${spiralSw}" fill="none" opacity="${spiralOp.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${dashAttrs}/>`;
  if (showParticles) {
    PARTICLES.forEach((p, i) => {
      const op = opts.particleOp ? opts.particleOp(i) : particleOpBase;
      if (op < 0.005) return;
      const pos = sp.pointAt(p.t);
      const r = p.r * (opts.particleScale ? opts.particleScale(i) : 1);
      const color = opts.particleColor ? opts.particleColor(i) : INK;
      s += `<circle cx="${pos[0].toFixed(2)}" cy="${pos[1].toFixed(2)}" r="${r.toFixed(2)}" fill="${color}" opacity="${op.toFixed(2)}"/>`;
    });
  }
  if (showBindu && binduOp > 0.01) {
    s += `<circle cx="${binduAt[0].toFixed(2)}" cy="${binduAt[1].toFixed(2)}" r="${(binduR * binduScale).toFixed(2)}" fill="${binduColor}" opacity="${binduOp.toFixed(2)}"/>`;
  }
  s += "</g>";
  if (opts.extras) s += opts.extras;
  return s;
}

export type BloomState =
  | "idle"
  | "loading"
  | "thinking"
  | "drafting"
  | "success"
  | "error"
  | "reveal";

type StateRenderer = {
  durationMs: number;
  kind: "loop" | "one-shot";
  render(svg: SVGSVGElement, ms: number, tier: Tier): void;
};

const STATES: Record<BloomState, StateRenderer> = {
  // Ambient breathing — 4s loop. The "still alive" tell.
  idle: {
    durationMs: 4000,
    kind: "loop",
    render(svg, ms, tier) {
      const t = (ms % 4000) / 4000;
      const lung = breath(t);
      svg.innerHTML = renderHTML({
        tier,
        spiralOp: tier.activeOp + 0.18 * lung,
        spiralSw: tier.activeSw + 0.2 * lung,
        particleScale: () => 1 + 0.55 * lung,
        particleOp: () => tier.particleOpBase + 0.22 * lung,
      });
    },
  },

  // Orbiting spinner — 1.6s loop. For the route loader.
  loading: {
    durationMs: 1600,
    kind: "loop",
    render(svg, ms, tier) {
      const t = (ms % 1600) / 1600;
      const angleDeg = t * 360;
      const orbitR = 56;
      const arcSweep = 70;
      const a0 = (-90) * Math.PI / 180;
      const a1 = (-90 + arcSweep) * Math.PI / 180;
      const x0 = (CX + orbitR * Math.cos(a0)).toFixed(2);
      const y0 = (CY + orbitR * Math.sin(a0)).toFixed(2);
      const x1 = (CX + orbitR * Math.cos(a1)).toFixed(2);
      const y1 = (CY + orbitR * Math.sin(a1)).toFixed(2);
      const arcPath = `M ${x0} ${y0} A ${orbitR} ${orbitR} 0 0 1 ${x1} ${y1}`;
      const lx = (CX + orbitR * Math.cos(a1)).toFixed(2);
      const ly = (CY + orbitR * Math.sin(a1)).toFixed(2);
      const arcSw = tier.name === "tiny" ? 4 : tier.activeSw + 1.4;
      const orbiter = `<g transform="rotate(${angleDeg.toFixed(2)} ${CX} ${CY})">
        <path d="${arcPath}" stroke="${INK}" stroke-width="${arcSw}" fill="none" stroke-linecap="round" opacity="0.92"/>
        <circle cx="${lx}" cy="${ly}" r="2.8" fill="${INK}" opacity="0.95"/>
      </g>`;
      svg.innerHTML = renderHTML({
        tier,
        spiralOp: Math.max(0, tier.activeOp - 0.18),
        particleOp: () => Math.max(0, tier.particleOpBase - 0.1),
        extras: orbiter,
      });
    },
  },

  // Cogitation cloud — 3.2s loop. Wandering focal points along the spiral.
  thinking: {
    durationMs: 3200,
    kind: "loop",
    render(svg, ms, tier) {
      const t = (ms % 3200) / 3200;
      const foA = 0.45 + 0.4 * Math.sin(t * Math.PI * 2);
      const foB = 0.7 + 0.2 * Math.sin(t * Math.PI * 2 + 1.7);
      const env = 0.5 - 0.5 * Math.cos(t * Math.PI * 4);
      function circDist(a: number, b: number) {
        const d = Math.abs(a - b);
        return d > 0.5 ? 1 - d : d;
      }
      function focalK(myT: number) {
        const dA = circDist(foA, myT);
        const dB = circDist(foB, myT);
        const reach = 0.18;
        const kA = dA < reach ? stepPrecise(1 - dA / reach) : 0;
        const kB = dB < reach ? stepPrecise(1 - dB / reach) * 0.6 : 0;
        return Math.max(kA, kB);
      }
      svg.innerHTML = renderHTML({
        tier,
        spiralOp: Math.max(0, tier.activeOp - 0.1),
        particleScale: (i) =>
          1 + 2.0 * focalK(PARTICLES[i].t) * (0.45 + 0.55 * env),
        particleOp: (i) =>
          tier.particleOpBase + 0.55 * focalK(PARTICLES[i].t) * (0.4 + 0.6 * env),
      });
    },
  },

  // Composing — 2.6s loop. Bindu walks the spiral outward, leaving a
  // brighter trail behind it. Reads as writing, not searching.
  drafting: {
    durationMs: 2600,
    kind: "loop",
    render(svg, ms, tier) {
      const t = (ms % 2600) / 2600;
      const phaseMs = t * 2600;
      let penT = 0;
      let trailOp = 0;
      let binduOp = 1;
      if (phaseMs < 1900) {
        penT = outSoft(phaseMs / 1900);
        trailOp = 1;
        binduOp = 1;
      } else if (phaseMs < 2400) {
        penT = 1;
        trailOp = 1;
        binduOp = 1 - houseEase((phaseMs - 1900) / 500);
      } else {
        penT = 1;
        trailOp = 1 - houseEase((phaseMs - 2400) / 200);
        binduOp = 0;
      }
      const sp = tier.spiral;
      const binduAt = sp.pointAt(penT);
      const pScale = (i: number) =>
        PARTICLES[i].t < penT ? 1.4 * trailOp + (1 - trailOp) : 1;
      const pOp = (i: number) =>
        PARTICLES[i].t < penT
          ? tier.particleOpBase + 0.3 * trailOp
          : tier.particleOpBase;
      let extras = "";
      if (tier.name !== "tiny" && trailOp > 0.02) {
        const trailLen = sp.total * penT;
        const restLen = sp.total - trailLen;
        extras += `<path d="${sp.d}" stroke="${INK}" stroke-width="${(tier.activeSw + 0.5).toFixed(2)}" fill="none" opacity="${(0.85 * trailOp).toFixed(2)}" stroke-linecap="round" stroke-dasharray="${trailLen.toFixed(1)} ${restLen.toFixed(1)}"/>`;
      }
      if (tier.name !== "tiny" && binduOp > 0.02) {
        extras += `<circle cx="${binduAt[0].toFixed(2)}" cy="${binduAt[1].toFixed(2)}" r="3.2" fill="${INK}" opacity="${(0.95 * binduOp).toFixed(2)}"/>`;
      }
      svg.innerHTML = renderHTML({
        tier,
        spiralOp: tier.activeOp,
        particleScale: pScale,
        particleOp: pOp,
        extras,
      });
    },
  },

  // Quiet commit — 1.4s one-shot. Green Bindu landing.
  success: {
    durationMs: 1400,
    kind: "one-shot",
    render(svg, ms, tier) {
      // ms is the elapsed time since the one-shot started.
      const m = Math.min(ms, 1400);
      let binduOp = 0;
      let binduScale = 0;
      let lift = 0;
      if (m < 380) {
        // spiral draws in, no Bindu yet
      } else if (m < 560) {
        const planPh = (m - 380) / 180;
        binduOp = clamp01(planPh * 1.4);
        binduScale = overshoot(planPh, 1.4);
        lift = stepPrecise(planPh);
      } else if (m < 1000) {
        binduOp = 1;
        binduScale = 1;
        const holdPh = (m - 560) / 440;
        lift = 1 - houseEase(holdPh);
      } else {
        const exitPh = (m - 1000) / 400;
        binduOp = 1 - houseEase(exitPh);
        binduScale = 1;
      }
      svg.innerHTML = renderHTML({
        tier,
        spiralOp: 0.82,
        showBindu: true,
        binduColor: SUCCESS,
        binduR: 5,
        binduOp,
        binduScale,
        particleScale: () => 1 + 0.35 * lift,
        particleOp: () => tier.particleOpBase + 0.25 * lift,
      });
    },
  },

  // Held breath — 3.2s one-shot then frozen by the AnimatedLogo host
  // (we treat the held tail as "stays visible until the user attends").
  // 220ms crash-in tap, 140ms recoil, then a slow held breath in red.
  error: {
    durationMs: 3200,
    kind: "one-shot",
    render(svg, ms, tier) {
      const m = Math.min(ms, 3200);
      let drawT: number;
      let spiralOp: number;
      let spiralSw: number;
      let hold = 0;
      if (m < 220) {
        const ph = errorTap(m / 220);
        drawT = ph;
        spiralOp = 0.92 * ph;
        spiralSw = tier.activeSw + 0.6 * ph;
      } else if (m < 360) {
        const r = (m - 220) / 140;
        drawT = 1;
        spiralOp = 0.92 - 0.1 * houseEase(r);
        spiralSw = tier.activeSw + 0.6 - 0.4 * houseEase(r);
      } else {
        drawT = 1;
        hold = 1;
        const breathT = ((m - 360) % 2200) / 2200;
        const lung = 0.5 - 0.5 * Math.cos(breathT * Math.PI * 2);
        spiralOp = 0.78 + 0.06 * lung;
        spiralSw = tier.activeSw + 0.2 + 0.1 * lung;
      }
      const pColor = (i: number) =>
        PARTICLES[i].t < drawT ? ERROR : INK;
      const pOp = (i: number) => {
        if (PARTICLES[i].t >= drawT) return tier.particleOpBase;
        if (hold) return tier.particleOpBase + 0.2;
        return tier.particleOpBase + 0.25 * drawT;
      };
      let binduScale = 1;
      if (hold) {
        const breathT = ((m - 360) % 2200) / 2200;
        const lung = 0.5 - 0.5 * Math.cos(breathT * Math.PI * 2);
        binduScale = 1 + 0.04 * lung;
      } else {
        binduScale = drawT;
      }
      svg.innerHTML = renderHTML({
        tier,
        spiralColor: ERROR,
        spiralOp,
        spiralSw,
        spiralDashOff: (1 - drawT) * tier.spiral.total,
        showBindu: true,
        binduColor: ERROR,
        binduScale,
        binduOp: hold ? 1 : drawT,
        particleColor: pColor,
        particleOp: pOp,
      });
    },
  },

  // Arrival — 1.5s one-shot. Bindu plants, spiral blooms outward, Bindu
  // dissolves into the mark. The brand's "hello."
  reveal: {
    durationMs: 1500,
    kind: "one-shot",
    render(svg, ms, tier) {
      const m = Math.min(ms, 1500);
      let binduScale = 0;
      let binduOp = 0;
      let spiralOp = 0;
      let spiralDashOff = tier.spiral.total;

      let particleOpFn: (i: number) => number = () => 0;
      let particleScaleFn: (i: number) => number = () => 1;

      if (m < 120) {
        const ph = houseEase(m / 120);
        binduScale = ph;
        binduOp = ph;
      } else if (m < 180) {
        const ph = (m - 120) / 60;
        binduScale =
          ph < 0.5 ? 1 + 0.06 * (ph / 0.5) : 1.06 - 0.06 * ((ph - 0.5) / 0.5);
        binduOp = 1;
      } else if (m < 1200) {
        binduScale = 1;
        binduOp = 1;
        const planMs = m - 180;
        const ph = planMs / 1020;
        spiralOp = tier.activeOp;
        spiralDashOff = (1 - ph) * tier.spiral.total;
        particleOpFn = (i) => {
          const passMs = 180 + PARTICLES[i].t * 1020;
          if (m < passMs) return 0;
          const tailPh = clamp01((m - passMs) / 200);
          return outSoft(tailPh) * tier.particleOpBase;
        };
        particleScaleFn = (i) => {
          const passMs = 180 + PARTICLES[i].t * 1020;
          if (m < passMs) return 0.6;
          const tailPh = clamp01((m - passMs) / 200);
          return 0.6 + 0.4 * outSoft(tailPh);
        };
      } else {
        const ph = houseEase((m - 1200) / 300);
        binduScale = 1 - 0.4 * ph;
        binduOp = 1 - ph;
        spiralOp = tier.activeOp;
        spiralDashOff = 0;
        particleOpFn = () => tier.particleOpBase;
        particleScaleFn = () => 1;
      }

      svg.innerHTML = renderHTML({
        tier,
        showBindu: true,
        binduScale,
        binduOp,
        spiralOp,
        spiralDashOff,
        particleOp: particleOpFn,
        particleScale: particleScaleFn,
      });
    },
  },
};

// Render a static "settled" mark — the default presentation when no
// state is animating. Same geometry, no motion.
export function renderSettled(svg: SVGSVGElement, sizePx: number): void {
  const tier = tierFor(sizePx);
  svg.innerHTML = renderHTML({ tier });
}

// Returns true if the renderer should keep ticking. For loops, always;
// for one-shots, false once the duration has elapsed.
export function tickState(
  svg: SVGSVGElement,
  state: BloomState,
  elapsedMs: number,
  sizePx: number
): boolean {
  const renderer = STATES[state];
  const tier = tierFor(sizePx);
  renderer.render(svg, elapsedMs, tier);
  if (renderer.kind === "one-shot" && elapsedMs >= renderer.durationMs) {
    return false;
  }
  return true;
}

export function stateDuration(state: BloomState): number {
  return STATES[state].durationMs;
}
