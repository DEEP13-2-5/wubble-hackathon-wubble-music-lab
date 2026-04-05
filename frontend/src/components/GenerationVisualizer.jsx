import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return () => { x = Math.sin(x) * 10000; return x - Math.floor(x); };
}

class Visualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(0, 0, 14);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.clock = new THREE.Clock();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.scene.add(new THREE.AmbientLight(0x9966ff, 1.2));
    const key = new THREE.PointLight(0xffd166, 2.5, 80);
    key.position.set(10, 10, 10); this.scene.add(key);
    this.mode = 'idle'; this.energy = 0.2;
    this._resize(); this._buildIdle(); this._loop();
    this._ro = new ResizeObserver(this._resize.bind(this));
    this._ro.observe(canvas);
  }

  _resize() {
    const b = this.canvas.getBoundingClientRect();
    const w = Math.max(200, b.width | 0), h = Math.max(180, b.height | 0);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _clear() {
    while (this.group.children.length) {
      const c = this.group.children.pop();
      c.geometry?.dispose();
      if (c.material) Array.isArray(c.material) ? c.material.forEach(m => m.dispose()) : c.material.dispose();
    }
  }

  _buildIdle() {
    this._clear();
    const geo = new THREE.TorusKnotGeometry(3.2, 0.9, 220, 24);
    const mat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, metalness: 0.4, roughness: 0.2, emissive: 0x4c1d95, emissiveIntensity: 0.4 });
    this.group.add(new THREE.Mesh(geo, mat));
    this.mode = 'idle'; this.energy = 0.2;
  }

  startGeneration(style, seed) {
    this._clear();
    const r = seededRandom(seed || Date.now());
    if (style === 'wave') {
      for (let i = 0; i < 120; i++) {
        const g = new THREE.SphereGeometry(0.12 + r() * 0.2, 10, 10);
        const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${260 + r() * 80} 80% 65%)`), emissive: 0x1a0050, emissiveIntensity: 0.4 });
        const n = new THREE.Mesh(g, m);
        n.position.set((r() - 0.5) * 13, (r() - 0.5) * 7, (r() - 0.5) * 10);
        this.group.add(n);
      }
    } else if (style === 'storm') {
      for (let i = 0; i < 80; i++) {
        const g = new THREE.ConeGeometry(0.1 + r() * 0.35, 0.8 + r() * 1.8, 6);
        const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${r() * 360} 90% 60%)`), metalness: 0.5, roughness: 0.2 });
        const s = new THREE.Mesh(g, m);
        s.position.set((r() - 0.5) * 14, (r() - 0.5) * 8, (r() - 0.5) * 10);
        s.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
        this.group.add(s);
      }
    } else if (style === 'spiral') {
      const curve = new THREE.CatmullRomCurve3(
        Array.from({ length: 24 }, (_, i) => {
          const t = i / 23, a = t * Math.PI * 8;
          return new THREE.Vector3(Math.cos(a) * 3.4, (t - 0.5) * 8, Math.sin(a) * 3.4);
        })
      );
      const g = new THREE.TubeGeometry(curve, 280, 0.22, 14, false);
      const m = new THREE.MeshStandardMaterial({ color: 0xa78bfa, emissive: 0x4c1d95, emissiveIntensity: 0.6 });
      this.group.add(new THREE.Mesh(g, m));
    } else if (style === 'shards') {
      const pos = new Float32Array(220 * 3);
      for (let i = 0; i < 220; i++) { pos[i*3]=(r()-0.5)*20; pos[i*3+1]=(r()-0.5)*10; pos[i*3+2]=(r()-0.5)*20; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xec4899, size: 0.16, transparent: true, opacity: 0.9 })));
    } else {
      for (let i = 0; i < 7; i++) {
        const g = new THREE.TorusGeometry(1 + i * 0.35, 0.06 + i * 0.02, 16, 100);
        const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${260 + i * 20} 90% 65%)`), transparent: true, opacity: 0.8 });
        const ring = new THREE.Mesh(g, m);
        ring.rotation.x = i * 0.42;
        this.group.add(ring);
      }
    }
    this.mode = 'generate'; this.energy = 1;
  }

  finishGeneration() {
    this.mode = 'cooldown'; this.energy = 0.6;
    setTimeout(() => this._buildIdle(), 2200);
  }

  _loop() {
    this._af = requestAnimationFrame(() => this._loop());
    const t = this.clock.getElapsedTime();
    if (this.mode === 'generate') {
      this.group.rotation.y += 0.013;
      this.group.rotation.x = Math.sin(t * 0.7) * 0.5;
      this.group.children.forEach((c, i) => { c.position.y += Math.sin(t * 3 + i * 0.1) * 0.003; c.rotation.z += 0.009; });
      this.camera.position.z = 11 + Math.sin(t * 2) * 1.8;
    } else if (this.mode === 'cooldown') {
      this.group.rotation.y += 0.006;
      this.camera.position.z += (14 - this.camera.position.z) * 0.06;
    } else {
      this.group.rotation.y += 0.004;
      this.group.rotation.x = Math.sin(t * 0.35) * 0.18;
      this.camera.position.z += (14 - this.camera.position.z) * 0.08;
    }
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this._af);
    this._ro?.disconnect();
    this._clear();
    this.renderer.dispose();
  }
}

export default function GenerationVisualizer({ status }) {
  const canvasRef = useRef(null);
  const vizRef = useRef(null);
  const prevStatus = useRef('idle');

  useEffect(() => {
    if (!canvasRef.current) return;
    vizRef.current = new Visualizer(canvasRef.current);
    return () => vizRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (!vizRef.current) return;
    if (status === 'loading' && prevStatus.current !== 'loading') {
      const styles = ['wave', 'storm', 'spiral', 'shards', 'nebula'];
      vizRef.current.startGeneration(styles[Math.floor(Math.random() * styles.length)], Date.now());
    }
    if ((status === 'success' || status === 'error') && prevStatus.current === 'loading') {
      vizRef.current.finishGeneration();
    }
    prevStatus.current = status;
  }, [status]);

  return (
    <div className="viz-wrap" style={{ minHeight: 280 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: 280, display: 'block', borderRadius: 20 }} />
      <div className="viz-status">
        {status === 'loading' ? '⚡ Generating…' : status === 'success' ? '✓ Done' : status === 'error' ? '⚠ Failed' : '● Ready'}
      </div>
    </div>
  );
}
