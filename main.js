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
const width = 400; // 論理的なゲーム領域は常に固定
const height = 600;

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

function getNextPlanetIndex() {
  const r = Math.random();
  if (r < 0.05) {
    return 12; // ミニブラックホール
  } else if (r < 0.10) {
    return 13; // ホワイトホール
  }
  return Math.floor(Math.random() * 5); // 通常の月〜金星
}

let nextPlanetIndex = getNextPlanetIndex();
let currentFalling = null;
let isGameOver = false;
let currentX = width / 2;
const blackHoles = [];
const whiteHoles = [];

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
    restitution: 0.3, // 少し弾むように
    friction: 0.005, // 摩擦を極端に下げて滑りやすく・転がりやすくする
    frictionStatic: 0.001, // 静止状態からの動き出しを良くする
    density: 0.002, // 質量を少し調整して重みを持たせる
    render: {
      fillStyle: planet.color, // フォールバック
    },
    planetIndex: index,
    isMerging: false
  });
  Composite.add(world, body);
  return body;
}

function updateCurrentX(clientX) {
  const rect = container.getBoundingClientRect();
  const scaleX = width / rect.width; // CSSによる縮小率を補正
  let x = (clientX - rect.left) * scaleX;
  const planetRadius = PLANETS[nextPlanetIndex].radius;
  currentX = Math.max(planetRadius, Math.min(width - planetRadius, x));
}

function triggerDrop() {
  if (isGameOver || currentFalling) return;
  
  currentFalling = addPlanet(currentX, 50, nextPlanetIndex);
  
  if (PLANETS[nextPlanetIndex].isItem) {
    currentFalling.createdAt = Date.now();
    currentFalling.lastSpitAt = Date.now(); // ホワイトホール用
    if (PLANETS[nextPlanetIndex].isBlackHole) blackHoles.push(currentFalling);
    if (PLANETS[nextPlanetIndex].isWhiteHole) whiteHoles.push(currentFalling);
  }
  
  nextPlanetIndex = getNextPlanetIndex();
  updateNextPreview();
  
  setTimeout(() => {
    currentFalling = null;
  }, 1000);
}

// マウス操作
container.addEventListener('mousemove', (e) => {
  if (isGameOver || currentFalling) return;
  updateCurrentX(e.clientX);
});
container.addEventListener('mousedown', (e) => {
  if (isGameOver || currentFalling) return;
  updateCurrentX(e.clientX);
});
container.addEventListener('mouseup', () => {
  triggerDrop();
});
container.addEventListener('mouseleave', () => {
  // コンテナ外に出た時も一応落とすか、キャンセルするか。今回は落とす。
  // ただし意図しない落下を防ぐため、今回は何もしない（画面内で離す想定）
});

// タッチ操作
container.addEventListener('touchmove', (e) => {
  if (isGameOver || currentFalling) return;
  // スクロールなどのデフォルト挙動を防止（ドラッグしやすくする）
  e.preventDefault();
  updateCurrentX(e.touches[0].clientX);
}, { passive: false });

container.addEventListener('touchstart', (e) => {
  if (isGameOver || currentFalling) return;
  // e.preventDefault(); を入れるとボタンが押せなくなる場合があるため注意
  updateCurrentX(e.touches[0].clientX);
}, { passive: true });

container.addEventListener('touchend', () => {
  triggerDrop();
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
        if (PLANETS[newIndex].isBlackHole && !PLANETS[newIndex].isItem) {
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
      if (!PLANETS[body.planetIndex].isItem) {
        setGameOver();
      }
    }
  });

  // ブラックホールの処理
  for (let i = blackHoles.length - 1; i >= 0; i--) {
    const bh = blackHoles[i];
    const planetDef = PLANETS[bh.planetIndex];

    // アイテム（ミニブラックホール）の寿命チェック
    if (planetDef.isItem) {
      if (Date.now() - bh.createdAt > 5000) {
        Composite.remove(world, bh);
        blackHoles.splice(i, 1);
        continue;
      }
    }

    bodies.forEach(body => {
      // 自身ではなく、まだ合体中でない惑星に対して
      if (body !== bh && body.planetIndex !== undefined && !body.isMerging) {
        const dx = bh.position.x - body.position.x;
        const dy = bh.position.y - body.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // ブラックホールから一定範囲内の惑星を吸い寄せる
        if (dist < 400) { // 吸い込み範囲
          // 吸い込まれた（ブラックホールの表面に触れた）場合
          const swallowDist = planetDef.radius + PLANETS[body.planetIndex].radius + 5;
          if (dist < swallowDist) {
            body.isMerging = true; // 削除マーク
            Composite.remove(world, body);
            score += PLANETS[body.planetIndex].score;
            scoreEl.innerText = score;
          } else {
            // ブラックホールに向かって力を加える
            const forceMagnitude = 0.0005 * body.mass; // 引力の強さを少し上げる
            Matter.Body.applyForce(body, body.position, {
              x: (dx / dist) * forceMagnitude,
              y: (dy / dist) * forceMagnitude
            });
          }
        }
      }
    });
  }

  // ホワイトホールの処理
  for (let i = whiteHoles.length - 1; i >= 0; i--) {
    const wh = whiteHoles[i];
    const planetDef = PLANETS[wh.planetIndex];

    if (Date.now() - wh.createdAt > 5000) {
      Composite.remove(world, wh);
      whiteHoles.splice(i, 1);
      continue;
    }

    // 斥力（吹き飛ばす力）
    bodies.forEach(body => {
      // ホワイトホール・ブラックホール以外のまだ合体中でない惑星に対して
      if (body !== wh && body.planetIndex !== undefined && !body.isMerging && !PLANETS[body.planetIndex].isWhiteHole && !PLANETS[body.planetIndex].isBlackHole) {
        const dx = body.position.x - wh.position.x;
        const dy = body.position.y - wh.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // ブラックホールと逆のベクトルで遠ざける
        if (dist < 300) {
          const forceMagnitude = 0.0002 * body.mass;
          Matter.Body.applyForce(body, body.position, {
            x: (dx / dist) * forceMagnitude,
            y: (dy / dist) * forceMagnitude
          });
        }
      }
    });

    // 定期的に星を吐き出す (500msに1回)
    if (Date.now() - wh.lastSpitAt > 500) {
      wh.lastSpitAt = Date.now();
      const spitIndex = Math.floor(Math.random() * 2); // 月か冥王星（小さい星）
      const spitRadius = PLANETS[spitIndex].radius;
      
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = planetDef.radius + spitRadius + 5;
      const spawnX = wh.position.x + Math.cos(angle) * spawnDist;
      const spawnY = wh.position.y + Math.sin(angle) * spawnDist;

      // 画面内に収まるように
      if (spawnX > 30 && spawnX < width - 30 && spawnY > 150 && spawnY < height - 50) {
        const newBody = addPlanet(spawnX, spawnY, spitIndex);
        const speed = 8; // 発射速度
        Matter.Body.setVelocity(newBody, {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed
        });
      }
    }
  }
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
  if (!planet.isBlackHole && !planet.isWhiteHole) {
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
  whiteHoles.length = 0;
  currentFalling = null;
  document.getElementById('game-over-screen').classList.add('hidden');
  
  nextPlanetIndex = getNextPlanetIndex();
  updateNextPreview();
});

// 初期化
updateNextPreview();
