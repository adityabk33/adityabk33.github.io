// Hero figure: geodesic regression on a sphere.
// Data points (dots) scatter around a fitted geodesic (solid arc);
// a privatized fit (dashed arc) stays on the sphere.
// It rotates slowly; drag to turn it. Respects "reduce motion".
(function () {
  const canvas = document.getElementById("sphere");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const col = (n) => css.getPropertyValue(n).trim();
  const C = { ink: col("--ink"), line: col("--line"), muted: col("--muted"), stat: col("--stat"), phys: col("--phys") };
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- small vector helpers ---
  const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const add = (a, b, s = 1) => a.map((x, i) => x + s * b[i]);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const geo = (p, v, t) => p.map((x, i) => Math.cos(t) * x + Math.sin(t) * v[i]); // unit p, v ⟂ p

  // Fitted geodesic: start point p, unit tangent v
  const p = norm([0.1, 0.55, 0.83]);
  const v = norm(cross(p, [0.2, 1, 0.1]));
  const nrm = norm(cross(p, v)); // normal to the geodesic's plane
  // Private fit: slightly perturbed point & direction, still on the sphere
  const p2 = norm(add(p, nrm, 0.12));
  const v2 = norm(add(v, nrm, -0.10));
  const v2p = norm(add(v2, p2, -v2.reduce((s, x, i) => s + x * p2[i], 0)));

  // Seeded random so the picture is the same on every visit
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const data = [];
  for (let i = 0; i < 26; i++) {
    const t = -1.15 + 2.3 * (i / 25) + 0.04 * gauss();
    data.push(norm(add(geo(p, v, t), nrm, 0.11 * gauss())));
  }

  let yaw = -0.9, pitch = 0.75, dpr = 1, size = 0, dragging = false, lastX = 0, lastY = 0;

  function rotate([x, y, z]) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
    const y1 = cp * y - sp * z1, z2 = sp * y + cp * z1;
    return [x1, y1, z2];
  }
  function proj(pt) {
    const [x, y, z] = rotate(pt), r = size * 0.4;
    return [size / 2 + x * r, size / 2 - y * r, z];
  }
  function path(points, color, width, dash, backAlpha) {
    // draw front (z>0) solid, back faint
    for (const front of [false, true]) {
      ctx.beginPath();
      let started = false;
      for (const pt of points) {
        const [x, y, z] = proj(pt);
        if ((z >= 0) === front) { started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true; }
        else started = false;
      }
      ctx.strokeStyle = color;
      ctx.globalAlpha = front ? 1 : backAlpha;
      ctx.lineWidth = width;
      ctx.setLineDash(dash || []);
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.setLineDash([]);
  }

  function draw() {
    ctx.clearRect(0, 0, size, size);
    const r = size * 0.4;
    // silhouette
    ctx.beginPath(); ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.stroke();
    // graticule
    for (let lat = -60; lat <= 60; lat += 30) {
      const a = (lat * Math.PI) / 180, pts = [];
      for (let k = 0; k <= 96; k++) { const b = (k / 96) * 2 * Math.PI; pts.push([Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)]); }
      path(pts, C.muted, 0.7, null, 0.18);
    }
    for (let lon = 0; lon < 180; lon += 30) {
      const b = (lon * Math.PI) / 180, pts = [];
      for (let k = 0; k <= 96; k++) { const a = (k / 96) * 2 * Math.PI; pts.push([Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)]); }
      path(pts, C.muted, 0.7, null, 0.18);
    }
    // residuals + data
    for (const d of data) {
      const [x, y, z] = proj(d);
      ctx.globalAlpha = z >= 0 ? 1 : 0.25;
      ctx.beginPath(); ctx.arc(x, y, size * 0.0085, 0, Math.PI * 2);
      ctx.fillStyle = C.ink; ctx.fill();
    }
    ctx.globalAlpha = 1;
    // geodesics
    const arc = (pp, vv) => { const a = []; for (let k = 0; k <= 80; k++) a.push(geo(pp, vv, -1.35 + 2.7 * (k / 80))); return a; };
    path(arc(p2, v2p), C.phys, 2, [6, 5], 0.25);
    path(arc(p, v), C.stat, 3, null, 0.3);
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1; size = box.width;
    canvas.width = box.width * dpr; canvas.height = box.width * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.008;
    pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - lastY) * 0.008));
    lastX = e.clientX; lastY = e.clientY; draw();
  });
  canvas.addEventListener("pointerup", () => (dragging = false));

  window.addEventListener("resize", resize);
  resize();
  if (!still) {
    (function tick() { if (!dragging) { yaw += 0.0025; draw(); } requestAnimationFrame(tick); })();
  }
})();
