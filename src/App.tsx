// src/App.tsx

import React, { useRef, useEffect, useState } from 'react';
import { SimulationController } from './SimulationController';
import type { VisualConfig } from './types';
import './App.css'; 

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState({
    evolutionCount: 0,
    currentCreatures: 0,
    totalCreatures: 0,
    bestDistance: 0,
    nextEvolutionIn: 15,
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Set the canvas resolution to match its display size for sharp rendering
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    context.scale(window.devicePixelRatio, window.devicePixelRatio);

    const config: VisualConfig = {
      width: rect.width,
      height: rect.height,
      groundY: rect.height,
      bodyRadius: 10,
      bodyOptions: { restitution: 0.2 },
      bodyColor: '#3498db',
      muscleColor: '#e74c3c',
    };

    // instantiate once
    const sim = new SimulationController(config, canvas);

    // Update stats every second
    const statsInterval = setInterval(() => {
      const bestCreatures = sim.getTopCreatures(1);
      const lastBest = bestCreatures[0];
      const timeUntilEvolution = sim.getTimeUntilNextEvolution();
      setStats({
        evolutionCount: sim.getEvolutionCount(),
        currentCreatures: sim.getCurrentCreatureCount(),
        totalCreatures: sim.getTotalCreatureCount(),
        bestDistance: lastBest ? lastBest.maxX : 0,
        nextEvolutionIn: Math.ceil(timeUntilEvolution / 1000),
      });
    }, 1000);

    // optional: cleanup on unmount
    return () => {
      clearInterval(statsInterval);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100vh', padding: '2%' }}>
      <div style={{ marginBottom: '2%', color: '#f5f5f5', textAlign: 'center' }}>
        <h1>Simple Creature</h1>
        <p>Generation: {stats.evolutionCount} | Current Creatures: {stats.evolutionCount * 50 + stats.totalCreatures} | Best Distance: {stats.bestDistance.toFixed(2)}</p>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'start', width: '100%' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '90%', height: '90%', border: '0.1em solid #ccc' }}
        />
      </div>
    </div>
  );
};

export default App;
