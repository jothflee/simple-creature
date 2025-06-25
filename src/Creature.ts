// src/Creature.ts

import { World, Body, Bodies, Constraint } from 'matter-js';
import type { World as IWorld } from 'matter-js';
import type { MuscleConfig, VisualConfig } from './types';

// -- PHYSICS BODY WRAPPER --
export class PhysicsBody {
  body: Body;
  constructor(world: IWorld, x: number, y: number, radius: number, options = {}) {
    // Only collide with ground (category 0x0001)
    const bodyOptions = {
      ...options,
      friction: 0.8,
      frictionStatic: 0.8,
      frictionAir: 0.02,
      collisionFilter: { category: 0x0002, mask: 0x0001 }
    };
    this.body = Bodies.circle(x, y, radius, bodyOptions);
    World.add(world, this.body);
  }
}

// -- SPRING (MUSCLE) --
export class Muscle {
  constraint: Constraint;
  config: MuscleConfig;
  timer = 0;
  active = false;
  constructor(world: IWorld, a: PhysicsBody, b: PhysicsBody, config: MuscleConfig) {
    this.config = config;
    this.constraint = Constraint.create({
      bodyA: a.body,
      bodyB: b.body,
      length: config.restLength,
      stiffness: config.stiffness,
    });
    World.add(world, this.constraint);
  }
  update(delta: number, groundY: number) {
    if (this.config.activationType === 'periodic') {
      this.timer += delta;
      if (this.timer >= (this.config.period ?? 1000)) {
        this.active = !this.active;
        this.timer = 0;
      }
    } else if (this.config.activationType === 'onGroundContact') {
      const [A, B] = [this.constraint.bodyA, this.constraint.bodyB];
      if (A && B && (A.position.y >= groundY || B.position.y >= groundY)) {
        this.active = !this.active;
      }
    }
    const target = this.active
      ? this.config.restLength * (this.config.extensionFactor ?? 1.5)
      : this.config.restLength;
    this.constraint.length = target;
  }
}

// -- CREATURE: A CHAIN OF BODIES + MUSCLES --
export class Creature {
  bodies: PhysicsBody[];
  muscles: Muscle[];
  bornAt = Date.now();
  maxX = 0;
  id: number;
  constructor(bodies: PhysicsBody[], muscles: Muscle[]) {
    this.id = Date.now() + Math.random();
    this.bodies = bodies;
    this.muscles = muscles;
  }
  update(delta: number, groundY: number) {
    this.muscles.forEach(m => m.update(delta, groundY));
    this.maxX = Math.max(this.maxX, ...this.bodies.map(b => b.body.position.x));
  }
  removeFromWorld(world: IWorld) {
    this.bodies.forEach(body => World.remove(world, body.body));
    this.muscles.forEach(muscle => World.remove(world, muscle.constraint));
  }
  clone(world: IWorld, centerX: number, centerY: number, scale = 1, colorIndex = 0, cfg: VisualConfig) {
    const creatureCenterX = this.bodies.reduce((sum, body) => sum + body.body.position.x, 0) / this.bodies.length;
    const creatureCenterY = this.bodies.reduce((sum, body) => sum + body.body.position.y, 0) / this.bodies.length;
    const clonedBodies: PhysicsBody[] = [];
    this.bodies.forEach(originalBody => {
      const offsetX = originalBody.body.position.x - creatureCenterX;
      const offsetY = originalBody.body.position.y - creatureCenterY;
      const newBody = new PhysicsBody(
        world,
        centerX + offsetX * scale,
        centerY + offsetY * scale,
        cfg.bodyRadius * scale,
        { 
          ...cfg.bodyOptions, 
          render: { fillStyle: `hsl(${colorIndex * 120}, 70%, 60%)` },
          frictionAir: 0.1,
          frictionStatic: 0.5,
          friction: 0.3
        }
      );
      Body.setVelocity(newBody.body, { x: 0, y: 0 });
      Body.setAngularVelocity(newBody.body, 0);
      clonedBodies.push(newBody);
    });
    const clonedMuscles: Muscle[] = [];
    this.muscles.forEach(originalMuscle => {
      const bodyAIndex = this.bodies.findIndex(b => b.body === originalMuscle.constraint.bodyA);
      const bodyBIndex = this.bodies.findIndex(b => b.body === originalMuscle.constraint.bodyB);
      if (bodyAIndex !== -1 && bodyBIndex !== -1 && clonedBodies[bodyAIndex] && clonedBodies[bodyBIndex]) {
        const clonedMuscle = new Muscle(world, clonedBodies[bodyAIndex], clonedBodies[bodyBIndex], {
          ...originalMuscle.config,
          period: (originalMuscle.config.period ?? 1000) * (0.95 + Math.random() * 0.1),
          extensionFactor: (originalMuscle.config.extensionFactor ?? 1.2) * (0.98 + Math.random() * 0.04),
        });
        clonedMuscles.push(clonedMuscle);
      }
    });
    return { bodies: clonedBodies, muscles: clonedMuscles };
  }
}
