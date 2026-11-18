import * as THREE from 'three';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas not supported');
  return [c, ctx];
}

/** Facade texture: wall colour with a grid of windows, some lit. One tile = 4 x 3 windows. */
export function makeFacadeTexture(wall: string, seed: number): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 192);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 256, 192);
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const cols = 4;
  const rows = 3;
  const cw = 256 / cols;
  const ch = 192 / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rnd() < 0.3;
      ctx.fillStyle = lit ? '#ffe9a8' : '#20303f';
      ctx.fillRect(x * cw + cw * 0.22, y * ch + ch * 0.2, cw * 0.56, ch * 0.55);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x * cw + cw * 0.22, y * ch + ch * 0.2, cw * 0.56, ch * 0.08);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Plain industrial facade with a horizontal stripe and a few high windows. */
export function makeIndustrialTexture(wall: string, stripe: string): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 128);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 88, 256, 14);
  ctx.fillStyle = '#23313f';
  for (let x = 0; x < 4; x++) ctx.fillRect(x * 64 + 14, 16, 36, 22);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeTextTexture(text: string, bg: string, fg: string, w = 1024, h = 160): THREE.CanvasTexture {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = Math.floor(h * 0.6);
  ctx.font = `bold ${size}px sans-serif`;
  while (ctx.measureText(text).width > w * 0.9 && size > 10) {
    size -= 4;
    ctx.font = `bold ${size}px sans-serif`;
  }
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeHazardTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#8b1e1e';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#e0dcd0';
  ctx.beginPath();
  for (let k = -2; k < 4; k++) {
    ctx.moveTo(k * 64, 0);
    ctx.lineTo(k * 64 + 32, 0);
    ctx.lineTo(k * 64 + 32 - 128, 128);
    ctx.lineTo(k * 64 - 128, 128);
  }
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeGrassTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#5c8a3c';
  ctx.fillRect(0, 0, 128, 128);
  let s = 7;
  for (let k = 0; k < 500; k++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const x = s % 128;
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const y = s % 128;
    ctx.fillStyle = k % 2 ? '#65953f' : '#527d36';
    ctx.fillRect(x, y, 3, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
