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
    return 14; // 青色超巨星（アイテム）
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
const supermassiveStars = [];

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
    if (PLANETS[nextPlanetIndex].isSupermassive) supermassiveStars.push(currentFalling);
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
        // 超大質量星(11)以上のインデックスは合体しない
        if (bodyA.planetIndex >= 11) continue;
        
        let newIndex = bodyA.planetIndex + 1;
        // 念のための上限チェック
        if (newIndex >= PLANETS.length) continue;
      
        if (bodyA.isMerging || bodyB.isMerging) continue; // 既に合体処理中ならスキップ
        bodyA.isMerging = true;
        bodyB.isMerging = true;

        Composite.remove(world, [bodyA, bodyB]);

        const newX = (bodyA.position.x + bodyB.position.x) / 2;
        const newY = (bodyA.position.y + bodyB.position.y) / 2;
        // スコア加算
        score += PLANETS[newIndex].score;
        scoreEl.innerText = score;

        const newBody = addPlanet(newX, newY, newIndex);
        
        // ブラックホールが生成された場合、特別リストに追加
        if (PLANETS[newIndex].isBlackHole && !PLANETS[newIndex].isItem) {
          blackHoles.push(newBody);
        }
        
        // 超大質量星が生成された場合、爆発タイマーをセット
        if (PLANETS[newIndex].isSupermassive && !PLANETS[newIndex].isItem) {
          newBody.createdAt = Date.now();
          supermassiveStars.push(newBody);
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

  // 超大質量星（時限爆弾）の処理
  for (let i = supermassiveStars.length - 1; i >= 0; i--) {
    const star = supermassiveStars[i];
    const planetDef = PLANETS[star.planetIndex];

    if (Date.now() - star.createdAt > 10000) { // 10秒で爆発
      const x = star.position.x;
      const y = star.position.y;

      // 超新星爆発: 周囲の星を吹き飛ばす
      bodies.forEach(body => {
        if (body !== star && body.planetIndex !== undefined && !body.isMerging) {
          const dx = body.position.x - x;
          const dy = body.position.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 400) {
            // 爆風（距離が近いほど強い）
            const force = (400 - dist) * 0.0003 * body.mass;
            Matter.Body.applyForce(body, body.position, {
              x: (dx / dist) * force,
              y: (dy / dist) * force
            });
          }
        }
      });

      // 自身を削除
      Composite.remove(world, star);
      supermassiveStars.splice(i, 1);

      // 跡地にブラックホールを生成
      const bhIndex = planetDef.isItem ? 15 : 12; // アイテムならミニBH(15)、通常なら特大BH(12)
      const newBH = addPlanet(x, y, bhIndex);
      
      // 全てのブラックホールに寿命を持たせる
      newBH.createdAt = Date.now();
      blackHoles.push(newBH);
    }
  }

  // ブラックホールの処理
  for (let i = blackHoles.length - 1; i >= 0; i--) {
    const bh = blackHoles[i];
    const planetDef = PLANETS[bh.planetIndex];

    // ブラックホールの寿命チェック（アイテムは5秒、通常は10秒）
    const lifespan = planetDef.isItem ? 5000 : 10000;
    if (Date.now() - bh.createdAt > lifespan) {
      Composite.remove(world, bh);
      blackHoles.splice(i, 1);
      continue;
    }

    bodies.forEach(body => {
      // 自身ではなく、まだ合体中でない惑星に対して
      if (body !== bh && body.planetIndex !== undefined && !body.isMerging) {
        const dx = bh.position.x - body.position.x;
        const dy = bh.position.y - body.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // ブラックホールから一定範囲内の惑星を吸い寄せる
        const pullRadius = planetDef.radius * 2.0; // 吸引範囲をさらに少し狭く
        if (dist < pullRadius) {
          // 吸い込まれた（ブラックホールの表面に触れた）場合
          const swallowDist = planetDef.radius + PLANETS[body.planetIndex].radius + 5;
          if (dist < swallowDist) {
            body.isMerging = true; // 削除マーク
            Composite.remove(world, body);
            score += PLANETS[body.planetIndex].score;
            scoreEl.innerText = score;
          } else {
            // 吸引力をさらに弱く
            const forceMagnitude = 0.00010 * body.mass; 
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
  if (!planet.isBlackHole && !planet.isWhiteHole && !planet.isSupermassive) {
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
  supermassiveStars.length = 0;
  currentFalling = null;
  document.getElementById('game-over-screen').classList.add('hidden');
  
  nextPlanetIndex = getNextPlanetIndex();
  updateNextPreview();
});

// 初期化
updateNextPreview();

// ======================================
// 惑星図鑑（Legend）ロジック
// ======================================
const infoBtn = document.getElementById('info-button');
const legendModal = document.getElementById('legend-modal');
const closeLegendBtn = document.getElementById('close-legend');
const legendList = document.getElementById('legend-list');

const PLANET_DESCRIPTIONS = {
  0: "一番最初の小さな星。とっても軽くてよく転がります。",
  1: "準惑星。月とくっつくとこれになります。",
  2: "太陽系で一番小さな惑星。クレーターがいっぱい。",
  3: "赤い惑星。氷の帽子（極冠）を被っています。",
  4: "地球の兄弟星。とても熱い雲に覆われています。",
  5: "我々の故郷！青い海と緑の大地が特徴です。",
  6: "青く輝く巨大な氷の惑星。",
  7: "横倒しで自転している氷の惑星。うっすらとした環があります。",
  8: "美しく巨大な環を持つガス惑星。とても軽いです。",
  9: "太陽系最大の惑星。大赤斑とシマシマ模様が特徴。",
  10: "燃え盛る巨大な恒星。これ同士をくっつけると…？",
  11: "【超大質量星】太陽の合体で誕生。10秒後に超新星爆発を起こします。",
  12: "【ブラックホール】超新星爆発の跡地に誕生。10秒間、周りの星を飲み込みます！",
  13: "【ホワイトホール】（お邪魔）5%で降ってくる。5秒間、小さな星を吐き出して盤面を荒らします。",
  14: "【青色超巨星】（お助け）5%で降ってくる寿命間近の星。10秒後に爆発し、ミニブラックホールになります。",
  15: "【ミニブラックホール】青色超巨星の爆発跡地に誕生。5秒間、周囲の星を吸い込みます！"
};

function initLegend() {
  legendList.innerHTML = '';
  PLANETS.forEach((planet, index) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    
    // アイコン描画用Canvas
    const cvs = document.createElement('canvas');
    cvs.width = 60;
    cvs.height = 60;
    const ctx = cvs.getContext('2d');
    ctx.translate(30, 30); // 中央を原点に
    
    // 描画用の仮スケール（最大サイズをはみ出さないように）
    const scale = planet.radius > 60 ? 25 / planet.radius : 1;
    ctx.scale(scale, scale);
    drawPlanetContent(ctx, planet, planet.radius);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // リセット

    const textDiv = document.createElement('div');
    textDiv.className = 'legend-text';
    textDiv.innerHTML = `<strong>${planet.name}</strong><br><span>${PLANET_DESCRIPTIONS[index] || ""}</span>`;

    item.appendChild(cvs);
    item.appendChild(textDiv);
    legendList.appendChild(item);
  });
}

infoBtn.addEventListener('click', () => {
  if (legendList.innerHTML === '') initLegend();
  legendModal.classList.remove('hidden');
  Runner.stop(runner); // 図鑑を開いている間は物理演算をポーズ
});

closeLegendBtn.addEventListener('click', () => {
  legendModal.classList.add('hidden');
  if (!isGameOver) {
    Runner.run(runner, engine); // 再開
  }
});
