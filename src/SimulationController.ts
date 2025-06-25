// src/SimulationController.ts

import { Engine, Body } from 'matter-js';
import { MainWorld } from './World';
import { Creature, PhysicsBody, Muscle } from './Creature';
import type { VisualConfig } from './types';

// -- CREATURE GENERATION --
export class CreatureGenerator {
  private engine: Engine;
  private cfg: VisualConfig;

  constructor(engine: Engine, cfg: VisualConfig) {
    this.engine = engine;
    this.cfg = cfg;
  }

  private getDistance(a: PhysicsBody, b: PhysicsBody): number {
    const dx = a.body.position.x - b.body.position.x;
    const dy = a.body.position.y - b.body.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Ensure all body points have at least two connections
  private ensureMinimumConnections(bodies: PhysicsBody[], muscles: Muscle[]) {
    const connectionMap = new Map<PhysicsBody, number>();
    bodies.forEach(body => connectionMap.set(body, 0));
    muscles.forEach(muscle => {
      const bodyA = bodies.find(b => b.body === muscle.constraint.bodyA);
      const bodyB = bodies.find(b => b.body === muscle.constraint.bodyB);
      if (bodyA) connectionMap.set(bodyA, (connectionMap.get(bodyA) || 0) + 1);
      if (bodyB) connectionMap.set(bodyB, (connectionMap.get(bodyB) || 0) + 1);
    });
    bodies.forEach(body => {
      while ((connectionMap.get(body) || 0) < 2) {
        const potentialTargets = bodies.filter(
          target => target !== body && (connectionMap.get(target) || 0) < 2
        );
        if (!potentialTargets.length) break;
        const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
        const distance = this.getDistance(body, target);
        muscles.push(new Muscle(this.engine.world, body, target, {
          restLength: distance,
          stiffness: 0.3 + Math.random() * 0.3,
          activationType: Math.random() < 0.5 ? 'periodic' : 'onGroundContact',
          period: 700 + Math.random() * 1200,
          extensionFactor: 1 + Math.random() * 0.4,
        }));
        connectionMap.set(body, (connectionMap.get(body) || 0) + 1);
        connectionMap.set(target, (connectionMap.get(target) || 0) + 1);
      }
    });
  }

  createRandomCreature(): Creature {
    const { groundY, bodyRadius, bodyOptions } = this.cfg;
    const count = 4 + Math.floor(Math.random() * 8);
    const bodies: PhysicsBody[] = [];
    const centerX = -100, centerY = groundY - 100, radius = 15 + Math.random() * 30;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 20;
      const y = centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 20;
      bodies.push(new PhysicsBody(this.engine.world, x, y, bodyRadius, bodyOptions));
    }
    const muscles: Muscle[] = [];
    for (let i = 0; i < count; i++) {
      const current = bodies[i], next = bodies[(i + 1) % count];
      const distance = this.getDistance(current, next);
      muscles.push(new Muscle(this.engine.world, current, next, {
        restLength: distance,
        stiffness: 0.3 + Math.random() * 0.7,
        activationType: Math.random() < 0.5 ? 'periodic' : 'onGroundContact',
        period: 250 + Math.random() * 1200,
        extensionFactor: 1 + Math.random() * 0.7,
      }));
    }
    const crossConnections = Math.floor(count / 2) + Math.floor(Math.random() * 2);
    for (let i = 0; i < crossConnections; i++) {
      const a = bodies[Math.floor(Math.random() * count)], b = bodies[Math.floor(Math.random() * count)];
      if (a !== b) {
        const distance = this.getDistance(a, b);
        muscles.push(new Muscle(this.engine.world, a, b, {
          restLength: distance,
          stiffness: 0.3 + Math.random() * 0.7,
          activationType: Math.random() < 0.5 ? 'periodic' : 'onGroundContact',
          period: 1000 + Math.random() * 1500,
          extensionFactor: 1.1 + Math.random() * 0.7,
        }));
      }
    }
    this.ensureMinimumConnections(bodies, muscles);
    return new Creature(bodies, muscles);
  }
}

// -- MAIN SIMULATION CONTROLLER --
export class SimulationController {
  private mainWorld: MainWorld;
  private cfg: VisualConfig;
  private generator: CreatureGenerator;
  
  private creatures: Creature[] = [];
  private deadCreatures: Set<number> = new Set();
  private evolutionCount = 0;
  private totalCreatures = 0;
  private lifetime = 15_000; // 15 seconds per creature
  private generationSize = 50;
  private top3HighScores: { id: number; distance: number }[] = [];
  private allCreatures: Map<number, Creature> = new Map();

  constructor(cfg: VisualConfig, canvas: HTMLCanvasElement) {
    this.cfg = cfg;
    this.mainWorld = new MainWorld(cfg, canvas);
    this.generator = new CreatureGenerator(this.mainWorld.getEngine(), cfg);
    // Trickle-in: add a new creature every 250ms
    setInterval(() => this.trickleAddCreature(), 250);
    // Start physics update loop
    this.startMainLoop();
  }

  private freezeCreature(creature: Creature) {
    this.deadCreatures.add(creature.id);
    creature.bodies.forEach(b => {
      b.body.isStatic = true;
      b.body.velocity.x = 0;
      b.body.velocity.y = 0;
      Body.setAngularVelocity(b.body, 0);
    });
  }

  private trickleAddCreature(): void {
    // Always keep top3 by maxX
    const top10 = [...this.creatures].sort((a, b) => b.maxX - a.maxX).slice(0, 10);
    // Remove oldest non-top3 if over limit
    if (this.creatures.length >= this.generationSize) {
      // Find oldest non-top3
      const nonTop10 = this.creatures.filter(c => !top10.includes(c));
      if (nonTop10.length > 0) {
        const oldest = nonTop10.reduce((a, b) => (a.bornAt < b.bornAt ? a : b));
        this.mainWorld.removeCreature(oldest.id);
        this.creatures = this.creatures.filter(c => c !== oldest);
        this.deadCreatures.delete(oldest.id);
      }
    }
    // Add new creature
    const creature = this.generator.createRandomCreature();
    creature.bornAt = Date.now();
    this.creatures.push(creature);
    this.mainWorld.addCreature(creature);
    this.totalCreatures++;
    // Epoch count: increment every 50 creatures added
    if (this.totalCreatures % 50 === 0) {
      this.evolutionCount++;
      this.totalCreatures = 0;
    }
  }

  private startMainLoop() {
    const loop = () => {
      // Only update living creatures
      const now = Date.now();
      // Find top3 by maxX (never freeze these)
      this.creatures.forEach(creature => {
        // Freeze if lifetime exceeded and not top3
        if (now - (creature.bornAt || 0) > this.lifetime) {
        this.freezeCreature(creature);
        } else {
        creature.update(16, this.cfg.groundY);
        }
      });

      // Update persistent top 3 high scores
      this.updateTop3HighScores();

      requestAnimationFrame(loop);
    };
    loop();
  }

  private updateTop3HighScores() {
    const byId = new Map<number, number>();
    this.allCreatures.forEach(c => {
      byId.set(c.id, c.maxX);
    });
    this.top3HighScores = Array.from(byId.entries())
      .map(([id, distance]) => ({ id, distance }))
      .sort((a, b) => b.distance - a.distance)
      .slice(0, 3);
  }

  getTop3HighScores(): { id: number; distance: number; rank: number }[] {
    return this.top3HighScores.map((entry, i) => ({ ...entry, rank: i + 1 }));
  }

  // Public methods for UI
  getEvolutionCount(): number {
    return this.evolutionCount;
  }

  getCurrentCreatureCount(): number {
    return this.creatures.length;
  }

  getTotalCreatureCount(): number {
    return this.totalCreatures;
  }

  getTopCreatures(count: number): Creature[] {
    return [...this.creatures].sort((a, b) => b.maxX - a.maxX).slice(0, count);
  }

  getTimeUntilNextEvolution(): number {
    // Time until the next creature (not top3) will die
    const now = Date.now();
    const nonTop3 = this.creatures.filter(c => ![...this.creatures].sort((a, b) => b.maxX - a.maxX).slice(0, 3).includes(c));
    if (nonTop3.length === 0) return this.lifetime;
    const nextToDie = Math.min(...nonTop3.map(c => (c.bornAt || 0) + this.lifetime - now));
    return Math.max(0, nextToDie);
  }

  cleanup(): void {
    this.mainWorld.cleanup();
  }
}
