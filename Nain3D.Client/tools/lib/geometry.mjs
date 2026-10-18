// Procedural geometry primitives for the sample generator.
// Every function returns { pos, nrm, uv, idx } in world space (Y up, no node transforms), because the
// in-browser evaluator reads POSITION accessor bounds without applying transforms.
// Parts are closed, outward-wound and free of degenerate triangles; `assertClosedSolid` proves it.

const EPS_AREA = 1e-10;

function emptyGeo() {
  return { pos: [], nrm: [], uv: [], idx: [] };
}

function norm3(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/**
 * Surface of revolution around the Y axis.
 * `runs` are polylines of [r, y] points traversed so the outside is on the right-hand side
 * in the (r, y) plane (bottom cap runs +r, side runs +y, top cap runs -r).
 * Each run is smooth-shaded on its own, so runs are the hard edges.
 */
export function lathe(runs, segments, { closedRuns = false } = {}) {
  const g = emptyGeo();
  for (const run of runs) {
    const pts = closedRuns ? [...run, run[0]] : run;
    const base = g.pos.length / 3;
    const rows = pts.length;
    const normals2d = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(rows - 1, i + 1)];
      const dr = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dr, dy) || 1;
      return [dy / l, -dr / l];
    });
    for (let i = 0; i < rows; i += 1) {
      for (let s = 0; s <= segments; s += 1) {
        const phi = (s % segments) / segments * Math.PI * 2;
        const c = Math.cos(phi);
        const sn = Math.sin(phi);
        g.pos.push(pts[i][0] * c, pts[i][1], pts[i][0] * sn);
        const [nr, ny] = normals2d[i];
        g.nrm.push(nr * c, ny, nr * sn);
        g.uv.push(s / segments, i / (rows - 1));
      }
    }
    const stride = segments + 1;
    for (let i = 0; i < rows - 1; i += 1) {
      for (let s = 0; s < segments; s += 1) {
        const A = base + i * stride + s;
        const B = A + 1;
        const C = base + (i + 1) * stride + s;
        const D = C + 1;
        pushIfSolid(g, A, C, B);
        pushIfSolid(g, B, C, D);
      }
    }
  }
  return g;
}

function pushIfSolid(g, a, b, c) {
  const p = (i) => [g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]];
  const pa = p(a);
  const pb = p(b);
  const pc = p(c);
  const ux = pb[0] - pa[0];
  const uy = pb[1] - pa[1];
  const uz = pb[2] - pa[2];
  const vx = pc[0] - pa[0];
  const vy = pc[1] - pa[1];
  const vz = pc[2] - pa[2];
  const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  if (area > EPS_AREA) g.idx.push(a, b, c);
}

/** Cylinder with a small chamfer so welded (smooth-averaged) normals still read as a crisp edge. */
export function cylinder(radius, y0, y1, segments = 24) {
  const c = Math.min(radius * 0.18, (y1 - y0) * 0.2);
  return lathe(
    [
      [[0, y0], [radius - c, y0], [radius, y0 + c], [radius, y1 - c], [radius - c, y1], [0, y1]],
    ],
    segments,
  );
}

/**
 * Merges vertices that share a position and rebuilds smooth, area-weighted normals.
 * The Python engine loads GLBs without vertex merging, so a watertight solid must be welded here.
 */
export function weld(g) {
  const q = (v) => Math.round(v * 1e6);
  const seen = new Map();
  const pos = [];
  const uv = [];
  const remap = new Array(g.pos.length / 3);
  for (let i = 0; i < g.pos.length / 3; i += 1) {
    const key = `${q(g.pos[i * 3])},${q(g.pos[i * 3 + 1])},${q(g.pos[i * 3 + 2])}`;
    let id = seen.get(key);
    if (id === undefined) {
      id = pos.length / 3;
      seen.set(key, id);
      pos.push(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]);
      uv.push(g.uv[i * 2], g.uv[i * 2 + 1]);
    }
    remap[i] = id;
  }
  const idx = [];
  const nrm = new Array(pos.length).fill(0);
  for (let t = 0; t < g.idx.length; t += 3) {
    const [a, b, c] = [remap[g.idx[t]], remap[g.idx[t + 1]], remap[g.idx[t + 2]]];
    if (a === b || b === c || a === c) continue;
    idx.push(a, b, c);
    const ux = pos[b * 3] - pos[a * 3];
    const uy = pos[b * 3 + 1] - pos[a * 3 + 1];
    const uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3];
    const vy = pos[c * 3 + 1] - pos[a * 3 + 1];
    const vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k += 1) nrm[v * 3 + k] += n[k];
  }
  for (let v = 0; v < nrm.length; v += 3) {
    const [x, y, z] = norm3(nrm[v], nrm[v + 1], nrm[v + 2]);
    nrm[v] = x;
    nrm[v + 1] = y;
    nrm[v + 2] = z;
  }
  return { pos, nrm, uv, idx };
}

export function sphere(radius, cy, segments = 32, rings = 16) {
  const pts = [];
  for (let k = 0; k <= rings; k += 1) {
    const t = (k / rings) * Math.PI;
    pts.push([radius * Math.sin(t), cy - radius * Math.cos(t)]);
  }
  return lathe([pts], segments);
}

export function torus(majorR, minorR, cy, segments = 48, tube = 12) {
  const pts = [];
  for (let k = 0; k < tube; k += 1) {
    const t = (k / tube) * Math.PI * 2; // counter-clockwise in (r, y) keeps the outside on the right
    pts.push([majorR + minorR * Math.cos(t), cy + minorR * Math.sin(t)]);
  }
  return lathe([pts], segments, { closedRuns: true });
}

/** Axis-aligned rounded box centred at (cx, cy, cz). `bevelSteps` controls the corner tessellation. */
export function roundedBox(sx, sy, sz, radius, bevelSteps, [cx, cy, cz], { screenUv = false } = {}) {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const axis = (h) => {
    const list = [];
    for (let k = bevelSteps; k >= 0; k -= 1) list.push(-(h - radius) - radius * Math.sin((k / bevelSteps) * Math.PI / 2));
    for (let k = 0; k <= bevelSteps; k += 1) list.push(h - radius + radius * Math.sin((k / bevelSteps) * Math.PI / 2));
    return list;
  };
  const ax = axis(hx);
  const ay = axis(hy);
  const az = axis(hz);
  const g = emptyGeo();
  const clamp = (v, h) => Math.max(-(h - radius), Math.min(h - radius, v));

  const emitFace = (fixedAxis, sign, u, v) => {
    const base = g.pos.length / 3;
    for (let j = 0; j < v.list.length; j += 1) {
      for (let i = 0; i < u.list.length; i += 1) {
        const q = [0, 0, 0];
        q[fixedAxis] = sign * [hx, hy, hz][fixedAxis];
        q[u.axis] = u.list[i];
        q[v.axis] = v.list[j];
        const half = [hx, hy, hz];
        const inner = q.map((val, a) => clamp(val, half[a]));
        const n = norm3(q[0] - inner[0], q[1] - inner[1], q[2] - inner[2]);
        const p = inner.map((val, a) => val + n[a] * radius);
        g.pos.push(p[0] + cx, p[1] + cy, p[2] + cz);
        g.nrm.push(n[0], n[1], n[2]);
        if (screenUv) g.uv.push((p[0] + hx) / sx, 1 - (p[1] + hy) / sy);
        else g.uv.push(i / (u.list.length - 1), j / (v.list.length - 1));
      }
    }
    const w = u.list.length;
    for (let j = 0; j < v.list.length - 1; j += 1) {
      for (let i = 0; i < w - 1; i += 1) {
        const A = base + j * w + i;
        const B = A + 1;
        const C = A + w;
        const D = C + 1;
        // Winding depends on the handedness of (u, v, fixed) for this face.
        const flip = ((fixedAxis + 1) % 3 === u.axis ? 1 : -1) * sign > 0;
        if (flip) {
          pushIfSolid(g, A, B, C);
          pushIfSolid(g, B, D, C);
        } else {
          pushIfSolid(g, A, C, B);
          pushIfSolid(g, B, C, D);
        }
      }
    }
  };

  const lists = [ax, ay, az];
  for (let f = 0; f < 3; f += 1) {
    const uAxis = (f + 1) % 3;
    const vAxis = (f + 2) % 3;
    for (const sign of [1, -1]) {
      emitFace(f, sign, { axis: uAxis, list: lists[uAxis] }, { axis: vAxis, list: lists[vAxis] });
    }
  }
  return g;
}

export function transform(g, fn) {
  const out = { pos: [], nrm: [], uv: [...g.uv], idx: [...g.idx] };
  for (let i = 0; i < g.pos.length; i += 3) {
    const p = fn.point([g.pos[i], g.pos[i + 1], g.pos[i + 2]]);
    const n = fn.normal([g.nrm[i], g.nrm[i + 1], g.nrm[i + 2]]);
    out.pos.push(...p);
    out.nrm.push(...n);
  }
  return out;
}

const rot = (axis, angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const f = ([x, y, z]) => {
    if (axis === 'x') return [x, y * c - z * s, y * s + z * c];
    if (axis === 'z') return [x * c - y * s, x * s + y * c, z];
    return [x * c + z * s, y, -x * s + z * c];
  };
  return { point: f, normal: f };
};

export const rotateX = (g, a) => transform(g, rot('x', a));
export const rotateY = (g, a) => transform(g, rot('y', a));
export const rotateZ = (g, a) => transform(g, rot('z', a));
export const translate = (g, [tx, ty, tz]) =>
  transform(g, { point: ([x, y, z]) => [x + tx, y + ty, z + tz], normal: (n) => n });
export const scale = (g, k) => transform(g, { point: ([x, y, z]) => [x * k, y * k, z * k], normal: (n) => n });

/** Throws unless the part is a closed, consistently outward-wound solid (no degenerate faces). */
export function assertClosedSolid(g, label) {
  // `+ 0` turns -0 into 0 so seam vertices computed from sin(2*pi) hash identically.
  const q = (v) => (Math.round(v * 1e6) / 1e6 + 0).toFixed(6);
  const key = (i) => `${q(g.pos[i * 3])},${q(g.pos[i * 3 + 1])},${q(g.pos[i * 3 + 2])}`;
  const edges = new Map();
  let volume = 0;
  for (let t = 0; t < g.idx.length; t += 3) {
    const [a, b, c] = [g.idx[t], g.idx[t + 1], g.idx[t + 2]];
    const ids = [key(a), key(b), key(c)];
    for (let e = 0; e < 3; e += 1) {
      const k = `${ids[e]}>${ids[(e + 1) % 3]}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
    const pa = [g.pos[a * 3], g.pos[a * 3 + 1], g.pos[a * 3 + 2]];
    const pb = [g.pos[b * 3], g.pos[b * 3 + 1], g.pos[b * 3 + 2]];
    const pc = [g.pos[c * 3], g.pos[c * 3 + 1], g.pos[c * 3 + 2]];
    volume +=
      (pa[0] * (pb[1] * pc[2] - pb[2] * pc[1]) -
        pa[1] * (pb[0] * pc[2] - pb[2] * pc[0]) +
        pa[2] * (pb[0] * pc[1] - pb[1] * pc[0])) / 6;
  }
  for (const [k, count] of edges) {
    const [p, q] = k.split('>');
    if (count !== 1 || edges.get(`${q}>${p}`) !== 1) {
      throw new Error(`${label}: open or non-manifold edge ${k}`);
    }
  }
  if (volume <= 0) throw new Error(`${label}: inward winding (signed volume ${volume})`);
  return volume;
}
