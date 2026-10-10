import React, { useEffect, useRef } from "react";

// Decorative force-directed graph in the style of Obsidian's graph view.
// The login page is public, so the graph is synthetic: generic entity types,
// never case data.

type GraphNode = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  label?: string;
  pinned: boolean;
};

const HUBS = ["Caso", "Persona", "Dominio", "Cuenta", "Evento", "Fuente", "IP"];

const buildGraph = () => {
  // deterministic pseudo-random numbers so the graph looks the same every time
  let seed = 20260410;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const nodes: GraphNode[] = [];
  const links: [number, number][] = [];
  HUBS.forEach((label, hub) => {
    const angle = (hub / HUBS.length) * Math.PI * 2;
    const distance = hub === 0 ? 0 : 0.25;
    nodes.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      vx: 0,
      vy: 0,
      r: hub === 0 ? 7 : 5,
      label,
      pinned: false,
    });
    if (hub > 0) {
      links.push([0, hub]);
    }
  });
  HUBS.forEach((_, hub) => {
    const leaves = hub === 0 ? 3 : 3 + Math.floor(random() * 5);
    for (let i = 0; i < leaves; i++) {
      const parent = nodes[hub];
      nodes.push({
        x: parent.x + (random() - 0.5) * 0.2,
        y: parent.y + (random() - 0.5) * 0.2,
        vx: 0,
        vy: 0,
        r: 2.5 + random() * 1.5,
        pinned: false,
      });
      links.push([hub, nodes.length - 1]);
    }
  });
  // a few cross-links between leaves of different hubs
  for (let i = 0; i < 6; i++) {
    const a = HUBS.length + Math.floor(random() * (nodes.length - HUBS.length));
    const b = HUBS.length + Math.floor(random() * (nodes.length - HUBS.length));
    if (a !== b) {
      links.push([a, b]);
    }
  }
  return { nodes, links };
};

export const ObsidianGraph = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const win = canvas?.ownerDocument.defaultView;
    if (!canvas || !ctx || !win) {
      return;
    }

    const { nodes, links } = buildGraph();
    const neighbors = nodes.map(() => new Set<number>());
    links.forEach(([a, b]) => {
      neighbors[a].add(b);
      neighbors[b].add(a);
    });

    const reducedMotion = win.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let size = 0;
    let colors = { node: "", link: "", accent: "", label: "" };
    let hovered = -1;
    let dragged = -1;
    let alpha = 1;
    let frame = 0;

    const readColors = () => {
      const style = win.getComputedStyle(canvas);
      colors = {
        node: style.getPropertyValue("--login-graph-node").trim(),
        link: style.getPropertyValue("--login-graph-link").trim(),
        accent: style.getPropertyValue("--login-primary").trim(),
        label: style.getPropertyValue("--login-muted").trim(),
      };
    };

    const resize = () => {
      const dpr = win.devicePixelRatio || 1;
      size = canvas.clientWidth;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readColors();
      draw();
    };

    // graph space is [-0.5, 0.5]; scale to the canvas
    const toScreen = (n: GraphNode) => ({
      x: (n.x + 0.5) * size,
      y: (n.y + 0.5) * size,
    });

    const tick = () => {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = Math.max(dx * dx + dy * dy, 0.0004);
          const force = (0.00003 / d2) * alpha;
          const d = Math.sqrt(d2);
          a.vx -= (dx / d) * force;
          a.vy -= (dy / d) * force;
          b.vx += (dx / d) * force;
          b.vy += (dy / d) * force;
        }
      }
      links.forEach(([i, j]) => {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const rest = i < HUBS.length && j < HUBS.length ? 0.2 : 0.06;
        const force = (d - rest) * 0.05 * alpha;
        a.vx += (dx / d) * force;
        a.vy += (dy / d) * force;
        b.vx -= (dx / d) * force;
        b.vy -= (dy / d) * force;
      });
      nodes.forEach((n) => {
        n.vx -= n.x * 0.02 * alpha;
        n.vy -= n.y * 0.02 * alpha;
        if (!n.pinned) {
          n.x = Math.max(-0.46, Math.min(0.46, n.x + n.vx));
          n.y = Math.max(-0.46, Math.min(0.46, n.y + n.vy));
        }
        n.vx *= 0.6;
        n.vy *= 0.6;
      });
      // cool down, but keep a little life while someone drags
      alpha = Math.max(alpha * 0.985, dragged >= 0 ? 0.3 : 0.02);
    };

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const focus = dragged >= 0 ? dragged : hovered;
      const isLit = (i: number) =>
        focus < 0 || i === focus || neighbors[focus].has(i);

      ctx.lineWidth = 1;
      links.forEach(([i, j]) => {
        const a = toScreen(nodes[i]);
        const b = toScreen(nodes[j]);
        const lit = focus >= 0 && (i === focus || j === focus);
        ctx.strokeStyle = lit ? colors.accent : colors.link;
        ctx.globalAlpha = focus >= 0 && !lit ? 0.25 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });

      nodes.forEach((n, i) => {
        const p = toScreen(n);
        ctx.globalAlpha = isLit(i) ? 1 : 0.3;
        ctx.fillStyle = i === focus ? colors.accent : colors.node;
        ctx.beginPath();
        ctx.arc(p.x, p.y, n.r + (i === focus ? 1.5 : 0), 0, Math.PI * 2);
        ctx.fill();
        if (n.label && (focus < 0 || isLit(i))) {
          ctx.fillStyle = colors.label;
          ctx.font = "12px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(n.label, p.x, p.y + n.r + 14);
        }
      });
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      tick();
      draw();
      frame = win.requestAnimationFrame(loop);
    };

    const nodeAt = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let best = -1;
      let bestDistance = 14 * 14;
      nodes.forEach((n, i) => {
        const p = toScreen(n);
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bestDistance) {
          best = i;
          bestDistance = d;
        }
      });
      return { index: best, x: x / size - 0.5, y: y / size - 0.5 };
    };

    const onPointerMove = (event: PointerEvent) => {
      const hit = nodeAt(event);
      if (dragged >= 0) {
        nodes[dragged].x = hit.x;
        nodes[dragged].y = hit.y;
      } else {
        hovered = hit.index;
        canvas.style.cursor = hovered >= 0 ? "grab" : "default";
      }
      if (reducedMotion) {
        draw();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const hit = nodeAt(event);
      if (hit.index < 0) {
        return;
      }
      dragged = hit.index;
      nodes[dragged].pinned = true;
      alpha = Math.max(alpha, 0.5);
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const onPointerUp = (event: PointerEvent) => {
      if (dragged >= 0) {
        nodes[dragged].pinned = false;
        dragged = -1;
        canvas.releasePointerCapture(event.pointerId);
        canvas.style.cursor = "grab";
      }
    };

    const onPointerLeave = () => {
      hovered = -1;
      if (reducedMotion) {
        draw();
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const colorScheme = win.matchMedia("(prefers-color-scheme: dark)");
    colorScheme.addEventListener("change", readColors);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);

    if (reducedMotion) {
      // settle once, then only redraw on hover
      for (let i = 0; i < 300; i++) {
        tick();
      }
      resize();
    } else {
      resize();
      frame = win.requestAnimationFrame(loop);
    }

    return () => {
      win.cancelAnimationFrame(frame);
      observer.disconnect();
      colorScheme.removeEventListener("change", readColors);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};
