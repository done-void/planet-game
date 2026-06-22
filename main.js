import './style.css';
import Matter from 'matter-js';
import { PLANETS } from './planets.js';

// Setup engine
const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Events = Matter.Events;

const engine = Engine.create();
const world = engine.world;

const container = document.getElementById('game-container');
const width = container.clientWidth;
const height = container.clientHeight;

const render = Render.create({
  element: container,
  engine: engine,
  options: {
    width,
    height,
    wireframes: false,
    background: 'transparent'
  }
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// Walls
const ground = Bodies.rectangle(width / 2, height + 30, width + 100, 60, { isStatic: true });
const leftWall = Bodies.rectangle(-30, height / 2, 60, height * 2, { isStatic: true });
const rightWall = Bodies.rectangle(width + 30, height / 2, 60, height * 2, { isStatic: true });

Composite.add(world, [ground, leftWall, rightWall]);

// Game State
let score = 0;
let nextPlanetIndex = Math.floor(Math.random() * 5); // 0 to 4 (月〜金星あたりが初期出現)
let currentFalling = null;
let isGameOver = false;
let currentX = width / 2;
const blackHoles = [];

const scoreEl = document.getElementById('score');
const nextPreviewEl = document.getElementById('next-preview');

function updateNextPreview() {
  const planet = PLANETS[nextPlanetIndex];
  nextPreviewEl.style.background = `radial-gradient(circle at 30% 30%, ${planet.gradient[0]}, ${planet.gradient[1]})`;
  
  if (!planet.isBlackHole) {
    nextPreviewEl.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%;">
        <div style="position: absolute; top: 30%; left: 25%; width: 12%; height: 12%; background: #1a1a1a; border-radius: 50%;"></div>
        <div style="position: absolute; top: 30%; right: 25%; width: 12%; height: 12%; background: #1a1a1a; border-radius: 50%;"></div>
        <div style="position: absolute; top: 50%; left: 35%; width: 30%; height: 20%; border-bottom: 2px solid #1a1a1a; border-radius: 50%;"></div>
        <div style="position: absolute; top: 45%; left: 15%; width: 15%; height: 15%; background: rgba(255, 100, 100, 0.5); border-radius: 50%;"></div>
        <div style="position: absolute; top: 45%; right: 15%; width: 15%; height: 15%; background: rgba(255, 100, 100, 0.5); border-radius: 50%;"></div>
      </div>
    `;
  } else {
    nextPreviewEl.innerHTML = '';
  }
}

function addPlanet(x, y, index) {
  const planet = PLANETS[index];
  const body = Bodies.circle(x, y, planet.radius, {
    restitution: 0.2, // 弾力性
    friction: 0.1, // 摩擦
    render: {
      fillStyle: planet.color, // フォールバック
    },
    planetIndex: index,
    isMerging: false
  });
  Composite.add(world, body);
  return body;
}

// ユーザー操作 (マウス移動とクリック)
container.addEventListener('mousemove', (e) => {
  if (isGameOver || currentFalling) return;
  const rect = container.getBoundingClientRect();
  let x = e.clientX - rect.left;
  const planetRadius = PLANETS[nextPlanetIndex].radius;
  currentX = Math.max(planetRadius, Math.min(width - planetRadius, x));
});

// タッチ操作対応
container.addEventListener('touchmove', (e) => {
  if (isGameOver || currentFalling) return;
  const rect = container.getBoundingClientRect();
  let x = e.touches[0].clientX - rect.left;
  const planetRadius = PLANETS[nextPlanetIndex].radius;
  currentX = Math.max(planetRadius, Math.min(width - planetRadius, x));
});

container.addEventListener('click', () => {
  if (isGameOver) return;
  if (currentFalling) return; // 落下中は次を落とせない
  
  currentFalling = addPlanet(currentX, 50, nextPlanetIndex);
  
  nextPlanetIndex = Math.floor(Math.random() * 5);
  updateNextPreview();
  
  // 連続投下を防ぐクールダウン
  setTimeout(() => {
    currentFalling = null;
  }, 1000);
});

// 衝突と合体
Events.on(engine, 'collisionStart', (event) => {
  const pairs = event.pairs;
  
  for (let i = 0; i < pairs.length; i++) {
    const bodyA = pairs[i].bodyA;
    const bodyB = pairs[i].bodyB;

    if (bodyA.planetIndex !== undefined && bodyA.planetIndex === bodyB.planetIndex) {
      const index = bodyA.planetIndex;
      
      // 同じ惑星同士が衝突し、かつ進化限界(ブラックホール)未満の場合
      if (index < PLANETS.length - 1) {
        if (bodyA.isMerging || bodyB.isMerging) continue; // 既に合体処理中ならスキップ
        bodyA.isMerging = true;
        bodyB.isMerging = true;

        Composite.remove(world, [bodyA, bodyB]);

        const newX = (bodyA.position.x + bodyB.position.x) / 2;
        const newY = (bodyA.position.y + bodyB.position.y) / 2;
        const newIndex = index + 1;

        // スコア加算
        score += PLANETS[newIndex].score;
        scoreEl.innerText = score;

        const newBody = addPlanet(newX, newY, newIndex);
        
        // ブラックホールが生成された場合、特別リストに追加
        if (PLANETS[newIndex].isBlackHole) {
          blackHoles.push(newBody);
        }
      }
    }
  }
});

// ブラックホールの吸引力とゲームオーバー判定
Events.on(engine, 'beforeUpdate', () => {
  if (isGameOver) return;
  
  const bodies = Composite.allBodies(world);
  
  bodies.forEach(body => {
    // ゲームオーバー判定: デッドライン(y=100)より上にあり、かつ静止している場合
    if (body.planetIndex !== undefined && body.position.y < 100 && Math.abs(body.velocity.y) < 0.2 && !currentFalling) {
      setGameOver();
    }
    
    // ブラックホールの処理
    blackHoles.forEach(bh => {
      // 自身ではなく、まだ合体中でない惑星に対して
      if (body !== bh && body.planetIndex !== undefined && !body.isMerging) {
        const dx = bh.position.x - body.position.x;
        const dy = bh.position.y - body.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // ブラックホールから一定範囲内の惑星を吸い寄せる
        if (dist < 400) { // 吸い込み範囲
          // 吸い込まれた（ブラックホールの中心付近に到達した）場合
          if (dist < PLANETS[bh.planetIndex].radius * 0.8) {
            body.isMerging = true; // 削除マーク
            Composite.remove(world, body);
            score += PLANETS[body.planetIndex].score;
            scoreEl.innerText = score;
          } else {
            // ブラックホールに向かって力を加える
            const forceMagnitude = 0.0003 * body.mass; // 引力の強さ
            Matter.Body.applyForce(body, body.position, {
              x: (dx / dist) * forceMagnitude,
              y: (dy / dist) * forceMagnitude
            });
          }
        }
      }
    });
  });
});

function drawPlanetContent(context, planet, radius) {
  // Base circle
  const grad = context.createRadialGradient(-radius*0.3, -radius*0.3, radius*0.1, 0, 0, radius);
  grad.addColorStop(0, planet.gradient[0]);
  grad.addColorStop(1, planet.gradient[1]);
  
  context.beginPath();
  context.arc(0, 0, radius, 0, 2 * Math.PI);
  context.fillStyle = grad;
  context.fill();

  // Features (模様や環)
  if (planet.feature === 'craters') {
    context.fillStyle = 'rgba(0,0,0,0.15)';
    context.beginPath(); context.arc(radius*0.3, -radius*0.2, radius*0.15, 0, 2*Math.PI); context.fill();
    context.beginPath(); context.arc(-radius*0.4, radius*0.3, radius*0.2, 0, 2*Math.PI); context.fill();
    context.beginPath(); context.arc(radius*0.1, radius*0.4, radius*0.1, 0, 2*Math.PI); context.fill();
  } else if (planet.feature === 'polar_cap') {
    context.fillStyle = 'rgba(255,255,255,0.6)';
    context.beginPath(); context.arc(0, -radius*0.8, radius*0.3, 0, 2*Math.PI); context.fill();
  } else if (planet.feature === 'clouds') {
    context.fillStyle = 'rgba(255,255,255,0.2)';
    context.beginPath(); context.ellipse(0, -radius*0.3, radius*0.8, radius*0.15, -0.2, 0, 2*Math.PI); context.fill();
    context.beginPath(); context.ellipse(0, radius*0.3, radius*0.7, radius*0.2, 0.1, 0, 2*Math.PI); context.fill();
  } else if (planet.feature === 'earth') {
    context.fillStyle = 'rgba(76, 175, 80, 0.8)';
    context.beginPath(); context.arc(-radius*0.2, -radius*0.2, radius*0.4, 0, 2*Math.PI); context.fill();
    context.beginPath(); context.arc(radius*0.3, radius*0.1, radius*0.3, 0, 2*Math.PI); context.fill();
  } else if (planet.feature === 'storm') {
    context.fillStyle = 'rgba(0,0,0,0.2)';
    context.beginPath(); context.ellipse(-radius*0.3, radius*0.1, radius*0.25, radius*0.15, -0.2, 0, 2*Math.PI); context.fill();
  } else if (planet.feature === 'stripes') {
    context.fillStyle = 'rgba(100,50,0,0.2)';
    context.fillRect(-radius, -radius*0.4, radius*2, radius*0.2);
    context.fillRect(-radius, radius*0.1, radius*2, radius*0.3);
    context.fillStyle = 'rgba(255,255,255,0.2)';
    context.fillRect(-radius, -radius*0.1, radius*2, radius*0.15);
    context.fillStyle = 'rgba(200,50,0,0.4)';
    context.beginPath(); context.ellipse(radius*0.3, radius*0.2, radius*0.2, radius*0.1, 0, 0, 2*Math.PI); context.fill();
  }

  // Face
  if (!planet.isBlackHole) {
    context.fillStyle = '#1a1a1a';
    const eyeOffsetX = radius * 0.35;
    const eyeOffsetY = -radius * 0.15;
    const eyeRadius = Math.max(radius * 0.1, 2);
    
    context.beginPath();
    context.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, 0, 2 * Math.PI);
    context.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, 2 * Math.PI);
    context.fill();
    
    context.beginPath();
    context.arc(0, radius * 0.1, radius * 0.3, 0, Math.PI, false);
    context.strokeStyle = '#1a1a1a';
    context.lineWidth = Math.max(radius * 0.05, 1.5);
    context.stroke();
    
    context.fillStyle = 'rgba(255, 100, 100, 0.5)';
    context.beginPath();
    context.arc(-eyeOffsetX * 1.2, radius * 0.15, eyeRadius, 0, 2 * Math.PI);
    context.fill();
    context.beginPath();
    context.arc(eyeOffsetX * 1.2, radius * 0.15, eyeRadius, 0, 2 * Math.PI);
    context.fill();
  }

  // Rings
  if (planet.feature === 'ring') {
    context.beginPath();
    context.ellipse(0, 0, radius*1.6, radius*0.4, -0.3, 0, 2*Math.PI);
    context.strokeStyle = 'rgba(230, 220, 200, 0.8)';
    context.lineWidth = radius * 0.15;
    context.stroke();
  } else if (planet.feature === 'ring_vertical') {
    context.beginPath();
    context.ellipse(0, 0, radius*1.3, radius*0.2, 1.2, 0, 2*Math.PI);
    context.strokeStyle = 'rgba(200, 220, 255, 0.6)';
    context.lineWidth = radius * 0.08;
    context.stroke();
  }

  // Outline
  context.beginPath();
  context.arc(0, 0, radius, 0, 2 * Math.PI);
  context.lineWidth = 1;
  context.strokeStyle = 'rgba(255,255,255,0.3)';
  context.stroke();
}

// リッチな描画（グラデーションの適用）
Events.on(render, 'afterRender', () => {
  const context = render.context;
  const bodies = Composite.allBodies(world);

  bodies.forEach(body => {
    if (body.planetIndex !== undefined) {
      const planet = PLANETS[body.planetIndex];
      const { x, y } = body.position;
      const radius = body.circleRadius;

      context.save();
      context.translate(x, y);
      context.rotate(body.angle);
      
      drawPlanetContent(context, planet, radius);
      
      context.restore();
    }
  });

  // 落とす位置のガイドラインとプレビュー
  if (!currentFalling && !isGameOver) {
    const planet = PLANETS[nextPlanetIndex];
    const radius = planet.radius;
    
    // ガイドライン
    context.save();
    context.beginPath();
    context.moveTo(currentX, 50);
    context.lineTo(currentX, height);
    context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    context.lineWidth = 2;
    context.setLineDash([5, 5]);
    context.stroke();
    context.restore();

    // プレビュー惑星
    context.save();
    context.translate(currentX, 50);
    context.globalAlpha = 0.5; // 半透明
    drawPlanetContent(context, planet, radius);
    context.restore();
  }
  
  // デッドラインの描画
  context.beginPath();
  context.moveTo(0, 100);
  context.lineTo(width, 100);
  context.strokeStyle = 'rgba(255, 60, 60, 0.5)';
  context.lineWidth = 2;
  context.setLineDash([10, 10]);
  context.stroke();
  context.setLineDash([]);
});

function setGameOver() {
  isGameOver = true;
  document.getElementById('game-over-screen').classList.remove('hidden');
  document.getElementById('final-score').innerText = score;
}

// リトライ処理
document.getElementById('retry-btn').addEventListener('click', () => {
  Composite.clear(world);
  Engine.clear(engine);
  Composite.add(world, [ground, leftWall, rightWall]); // 壁を再配置
  
  score = 0;
  scoreEl.innerText = score;
  isGameOver = false;
  blackHoles.length = 0;
  currentFalling = null;
  document.getElementById('game-over-screen').classList.add('hidden');
  
  nextPlanetIndex = Math.floor(Math.random() * 5);
  updateNextPreview();
});

// 初期化
updateNextPreview();
