import './style.css';
import Matter from 'matter-js';
import { PLANETS } from './planets.js';
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import * as Audio from './audio.js';

// DOM Elements
const container = document.getElementById('game-container');
const muteButton = document.getElementById('mute-button');

// Audio Initialization
if (muteButton) {
  muteButton.addEventListener('click', () => {
    const isMuted = Audio.toggleMute();
    muteButton.innerText = isMuted ? '🔇 BGM' : '🔊 BGM';
  });
}
document.body.addEventListener('pointerdown', () => {
  Audio.initAudio();
}, { once: true });

// AdMob Initialization
async function initAdMob() {
  try {
    await AdMob.initialize({});
    
    // バナー広告の表示 (下部)
    const bannerOptions = {
      adId: 'ca-app-pub-3940256099942544/6300978111', // Google Test Banner ID
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: true
    };
    await AdMob.showBanner(bannerOptions);

    // リワード広告（動画）のリスナー登録
    AdMob.addListener('rewardedVideoUserDidEarnReward', () => {
      // 視聴完了時の処理: 青色超巨星(14)かミニブラックホール(15)をランダムで付与
      const isSupernova = Math.random() < 0.5;
      currentPlanetIndex = isSupernova ? 14 : 15;
      // 強力なアイテムなので、次のNEXTは通常のものに戻しておく（連発防止）
      nextPlanetIndex = getNextPlanetIndex();
      updateNextPreview();
    });
    
  } catch (error) {
    console.log("AdMob init failed (might be running in web without native bridge):", error);
  }
}
initAdMob();

// インタースティシャル広告の準備と表示関数
async function showInterstitialAd() {
  try {
    const options = {
      adId: 'ca-app-pub-3940256099942544/1033173712', // Google Test Interstitial ID
      isTesting: true
    };
    await AdMob.prepareInterstitial(options);
    await AdMob.showInterstitial();
  } catch (error) {
    console.log("Interstitial ad failed:", error);
  }
}

// リワード広告の表示関数
async function showRewardVideoAd() {
  try {
    const options = {
      adId: 'ca-app-pub-3940256099942544/5224354917', // Google Test Rewarded Video ID
      isTesting: true
    };
    await AdMob.prepareRewardVideoAd(options);
    await AdMob.showRewardVideoAd();
  } catch (error) {
    console.log("Reward video ad failed:", error);
    // Web環境でのテスト用（動画が見れない場合は直接付与）
    const isSupernova = Math.random() < 0.5;
    currentPlanetIndex = isSupernova ? 14 : 15;
    nextPlanetIndex = getNextPlanetIndex();
    updateNextPreview();
  }
}

// プレイ回数のトラッキング用
let gamesPlayed = 0;
// Setup engine
const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Events = Matter.Events;

const engine = Engine.create();
const world = engine.world;


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

// Game Config (Constants)
const GAME_CONFIG = {
  supermassiveLifespan: 10000,
  supernovaRadius: 400,
  supernovaForceMultiplier: 0.0003,
  blackHoleLifespanNormal: 10000,
  blackHoleLifespanMini: 5000,
  blackHolePullForce: 0.00010,
  whiteHoleLifespan: 5000,
  whiteHolePushForce: 0.0002,
  whiteHolePushRadius: 300,
  whiteHoleSpitInterval: 500,
  whiteHoleSpitSpeed: 8
};

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

let currentPlanetIndex = getNextPlanetIndex();
let nextPlanetIndex = getNextPlanetIndex();let flashAlpha = 0;
// ハイスコアの読み込み
let bestScore = parseInt(localStorage.getItem('planetGameBestScore')) || 0;
document.getElementById('best-score').innerText = bestScore;

function updateScore(points) {
  score += points;
  scoreEl.innerText = score;
  
  if (score > bestScore) {
    bestScore = score;
    document.getElementById('best-score').innerText = bestScore;
    localStorage.setItem('planetGameBestScore', bestScore);
  }
  
  // 背景宇宙の進化
  const appEl = document.getElementById('app');
  if (score >= 3000) {
    appEl.className = 'bg-level-2';
  } else if (score >= 1000) {
    appEl.className = 'bg-level-1';
  }
}

// 落下物管理用の状態
let currentFalling = null;
let isGameOver = false;
let currentX = width / 2;
const blackHoles = [];
const whiteHoles = [];
const supermassiveStars = [];

const scoreEl = document.getElementById('score');
const nextPreviewCanvas = document.getElementById('next-preview-canvas');

function updateNextPreview() {
  if (!nextPreviewCanvas) return;
  const planet = PLANETS[nextPlanetIndex];
  const ctx = nextPreviewCanvas.getContext('2d');
  ctx.clearRect(0, 0, 60, 60);
  
  ctx.save();
  ctx.translate(30, 30);
  // 少し大きめの星は縮小して枠内に収める
  const scale = planet.radius > 60 ? 25 / planet.radius : 1;
  ctx.scale(scale, scale);
  drawPlanetContent(ctx, planet, planet.radius);
  ctx.restore();
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
  const planetRadius = PLANETS[currentPlanetIndex].radius;
  currentX = Math.max(planetRadius, Math.min(width - planetRadius, x));
}

function triggerDrop() {
  if (isGameOver || currentFalling) return;
  
  currentFalling = addPlanet(currentX, 50, currentPlanetIndex);
  Audio.playDropSound(); // 落下音
  
  if (PLANETS[currentPlanetIndex].isItem) {
    currentFalling.createdAt = Date.now();
    currentFalling.lastSpitAt = Date.now(); // ホワイトホール用
    if (PLANETS[currentPlanetIndex].isBlackHole) blackHoles.push(currentFalling);
    if (PLANETS[currentPlanetIndex].isWhiteHole) whiteHoles.push(currentFalling);
    if (PLANETS[currentPlanetIndex].isSupermassive) supermassiveStars.push(currentFalling);
  }
  
  // currentにnextを入れ、nextを新しく生成する
  currentPlanetIndex = nextPlanetIndex;
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
        // スコア加算と背景チェック
        updateScore(PLANETS[newIndex].score);

        const newBody = addPlanet(newX, newY, newIndex);
        Audio.playMergeSound(newIndex); // 合体音
        
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
  
  // ゲームオーバー判定
  if (!currentFalling) {
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (body.planetIndex !== undefined && body.position.y < 100 && Math.abs(body.velocity.y) < 0.2) {
        if (!PLANETS[body.planetIndex].isItem) {
          setGameOver();
          break;
        }
      }
    }
  }

  // 超大質量星（時限爆弾）の処理
  for (let i = supermassiveStars.length - 1; i >= 0; i--) {
    const star = supermassiveStars[i];
    
    // ゾンビ星対策：既に合体などで消滅している場合は配列から削除
    if (star.isMerging) {
      supermassiveStars.splice(i, 1);
      continue;
    }
    
    const planetDef = PLANETS[star.planetIndex];

    if (Date.now() - star.createdAt > GAME_CONFIG.supermassiveLifespan) { // 爆発
      const x = star.position.x;
      const y = star.position.y;

      // 超新星爆発: 周囲の星を吹き飛ばす
      bodies.forEach(body => {
        if (body !== star && body.planetIndex !== undefined && !body.isMerging) {
          const dx = body.position.x - x;
          const dy = body.position.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < GAME_CONFIG.supernovaRadius) {
            // 爆風（距離が近いほど強い）
            const force = (GAME_CONFIG.supernovaRadius - dist) * GAME_CONFIG.supernovaForceMultiplier * body.mass;
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
    
    // ゾンビ星対策：既に合体などで消滅している場合は配列から削除
    if (bh.isMerging) {
      blackHoles.splice(i, 1);
      continue;
    }
    
    const planetDef = PLANETS[bh.planetIndex];

    // ブラックホールの寿命チェック
    const lifespan = planetDef.isItem ? GAME_CONFIG.blackHoleLifespanMini : GAME_CONFIG.blackHoleLifespanNormal;
    if (Date.now() - bh.createdAt > lifespan) {
      bh.isMerging = true; // 削除フラグを立てて他からの参照も防ぐ
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
            // 吸引力を適用
            const forceMagnitude = GAME_CONFIG.blackHolePullForce * body.mass; 
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
    
    // ゾンビ星対策：既に消滅している場合は配列から削除
    if (wh.isMerging) {
      whiteHoles.splice(i, 1);
      continue;
    }
    
    const planetDef = PLANETS[wh.planetIndex];

    if (Date.now() - wh.createdAt > GAME_CONFIG.whiteHoleLifespan) {
      wh.isMerging = true; // 削除フラグ
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
        if (dist < GAME_CONFIG.whiteHolePushRadius) {
          const forceMagnitude = GAME_CONFIG.whiteHolePushForce * body.mass;
          Matter.Body.applyForce(body, body.position, {
            x: (dx / dist) * forceMagnitude,
            y: (dy / dist) * forceMagnitude
          });
        }
      }
    });

    // 定期的に星を吐き出す
    if (Date.now() - wh.lastSpitAt > GAME_CONFIG.whiteHoleSpitInterval) {
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
        const speed = GAME_CONFIG.whiteHoleSpitSpeed; // 発射速度
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

  // Face (全ての星に個性的な顔を描画)
  const faceColor = (planet.isBlackHole || planet.faceType === 'sparkle') ? '#ffffff' : '#1a1a1a';
  context.fillStyle = faceColor;
  context.strokeStyle = faceColor;
  
  const eyeOffsetX = radius * 0.35;
  const eyeOffsetY = -radius * 0.15;
  const eyeRadius = Math.max(radius * 0.1, 2);
  const lineWidth = Math.max(radius * 0.05, 1.5);
  context.lineWidth = lineWidth;
  context.lineCap = 'round';
  
  // ほっぺ（共通）
  if (planet.faceType !== 'sunglasses' && planet.faceType !== 'blackhole' && planet.faceType !== 'whitehole') {
    const blushAlpha = planet.isBlackHole ? 0.7 : 0.5;
    context.fillStyle = `rgba(255, 100, 100, ${blushAlpha})`;
    context.beginPath();
    context.arc(-eyeOffsetX * 1.2, radius * 0.15, eyeRadius, 0, 2 * Math.PI);
    context.fill();
    context.beginPath();
    context.arc(eyeOffsetX * 1.2, radius * 0.15, eyeRadius, 0, 2 * Math.PI);
    context.fill();
    context.fillStyle = faceColor; // 戻す
  }

  // 表情分岐
  switch (planet.faceType) {
    case 'sleepy':
      // 目: 横棒（- -）
      context.beginPath();
      context.moveTo(-eyeOffsetX - eyeRadius, eyeOffsetY);
      context.lineTo(-eyeOffsetX + eyeRadius, eyeOffsetY);
      context.moveTo(eyeOffsetX - eyeRadius, eyeOffsetY);
      context.lineTo(eyeOffsetX + eyeRadius, eyeOffsetY);
      context.stroke();
      // 口: 小さい口
      context.beginPath();
      context.arc(0, radius * 0.2, eyeRadius * 0.5, 0, 2 * Math.PI);
      context.fill();
      break;

    case 'angry':
      // 目: （> <）
      context.beginPath();
      context.moveTo(-eyeOffsetX - eyeRadius, eyeOffsetY - eyeRadius);
      context.lineTo(-eyeOffsetX, eyeOffsetY);
      context.lineTo(-eyeOffsetX - eyeRadius, eyeOffsetY + eyeRadius);
      context.moveTo(eyeOffsetX + eyeRadius, eyeOffsetY - eyeRadius);
      context.lineTo(eyeOffsetX, eyeOffsetY);
      context.lineTo(eyeOffsetX + eyeRadius, eyeOffsetY + eyeRadius);
      context.stroke();
      // 口: への字
      context.beginPath();
      context.moveTo(-eyeRadius, radius * 0.2 + eyeRadius);
      context.lineTo(0, radius * 0.2);
      context.lineTo(eyeRadius, radius * 0.2 + eyeRadius);
      context.stroke();
      break;

    case 'wink':
      // 左目: パッチリ, 右目: ウインク（<）
      context.beginPath();
      context.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, 0, 2 * Math.PI);
      context.fill();
      context.beginPath();
      context.moveTo(eyeOffsetX + eyeRadius, eyeOffsetY - eyeRadius);
      context.lineTo(eyeOffsetX, eyeOffsetY);
      context.lineTo(eyeOffsetX + eyeRadius, eyeOffsetY + eyeRadius);
      context.stroke();
      // 口: ニッコリ
      context.beginPath();
      context.arc(0, radius * 0.1, radius * 0.25, 0, Math.PI, false);
      context.stroke();
      break;

    case 'smile':
      // 目: ニッコリ（^ ^）
      context.beginPath();
      context.arc(-eyeOffsetX, eyeOffsetY + eyeRadius, eyeRadius, Math.PI, 0, false);
      context.stroke();
      context.beginPath();
      context.arc(eyeOffsetX, eyeOffsetY + eyeRadius, eyeRadius, Math.PI, 0, false);
      context.stroke();
      // 口: 大きく開けた笑顔
      context.beginPath();
      context.arc(0, radius * 0.05, radius * 0.25, 0, Math.PI, false);
      context.fillStyle = 'rgba(255,100,100,0.8)';
      context.fill();
      context.stroke();
      context.fillStyle = faceColor;
      break;

    case 'laugh':
      // 目: 通常
      context.beginPath();
      context.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, 0, 2 * Math.PI);
      context.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, 2 * Math.PI);
      context.fill();
      // 口: 大きな丸
      context.beginPath();
      context.ellipse(0, radius * 0.15, radius * 0.2, radius * 0.25, 0, 0, 2 * Math.PI);
      context.fill();
      break;

    case 'sunglasses':
      // サングラス
      context.fillStyle = '#111';
      context.beginPath();
      context.moveTo(-radius * 0.6, eyeOffsetY - eyeRadius * 1.5);
      context.lineTo(-radius * 0.1, eyeOffsetY - eyeRadius * 1.5);
      context.lineTo(0, eyeOffsetY + eyeRadius * 1.5);
      context.lineTo(-radius * 0.5, eyeOffsetY + eyeRadius * 1.5);
      context.fill();
      context.beginPath();
      context.moveTo(radius * 0.1, eyeOffsetY - eyeRadius * 1.5);
      context.lineTo(radius * 0.6, eyeOffsetY - eyeRadius * 1.5);
      context.lineTo(radius * 0.5, eyeOffsetY + eyeRadius * 1.5);
      context.lineTo(0, eyeOffsetY + eyeRadius * 1.5);
      context.fill();
      // テンプル（つる）
      context.beginPath();
      context.moveTo(-radius * 0.6, eyeOffsetY - eyeRadius);
      context.lineTo(-radius * 0.8, eyeOffsetY - eyeRadius * 2);
      context.moveTo(radius * 0.6, eyeOffsetY - eyeRadius);
      context.lineTo(radius * 0.8, eyeOffsetY - eyeRadius * 2);
      context.stroke();
      // 口: ニヤリ
      context.beginPath();
      context.moveTo(-radius * 0.1, radius * 0.2);
      context.lineTo(radius * 0.2, radius * 0.15);
      context.stroke();
      context.fillStyle = faceColor;
      break;

    case 'surprised':
      // 目: 見開く
      context.beginPath();
      context.arc(-eyeOffsetX, eyeOffsetY, eyeRadius * 1.5, 0, 2 * Math.PI);
      context.arc(eyeOffsetX, eyeOffsetY, eyeRadius * 1.5, 0, 2 * Math.PI);
      context.stroke();
      context.beginPath();
      context.arc(-eyeOffsetX, eyeOffsetY, eyeRadius * 0.5, 0, 2 * Math.PI);
      context.arc(eyeOffsetX, eyeOffsetY, eyeRadius * 0.5, 0, 2 * Math.PI);
      context.fill();
      // 口: 小さな点
      context.beginPath();
      context.arc(0, radius * 0.2, eyeRadius * 0.8, 0, 2 * Math.PI);
      context.stroke();
      break;

    case 'chill':
      // 目: 半目
      context.beginPath();
      context.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, Math.PI, 0, false);
      context.lineTo(-eyeOffsetX - eyeRadius, eyeOffsetY);
      context.fill();
      context.beginPath();
      context.arc(eyeOffsetX, eyeOffsetY, eyeRadius, Math.PI, 0, false);
      context.lineTo(eyeOffsetX - eyeRadius, eyeOffsetY);
      context.fill();
      // 口: への字
      context.beginPath();
      context.arc(0, radius * 0.2, radius * 0.2, Math.PI * 1.1, Math.PI * 1.9, false);
      context.stroke();
      break;

    case 'smug':
      // 目: ジト目
      context.beginPath();
      context.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI, false);
      context.fill();
      context.beginPath();
      context.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI, false);
      context.fill();
      // 口: 片方あがる
      context.beginPath();
      context.moveTo(-radius * 0.2, radius * 0.2);
      context.quadraticCurveTo(0, radius * 0.25, radius * 0.2, radius * 0.1);
      context.stroke();
      break;
      
    case 'sparkle':
      // 目: キラキラ（十字星）
      const drawStar = (x, y, r) => {
        context.beginPath();
        context.moveTo(x, y - r);
        context.quadraticCurveTo(x, y, x + r, y);
        context.quadraticCurveTo(x, y, x, y + r);
        context.quadraticCurveTo(x, y, x - r, y);
        context.quadraticCurveTo(x, y, x, y - r);
        context.fill();
      };
      drawStar(-eyeOffsetX, eyeOffsetY, eyeRadius * 2);
      drawStar(eyeOffsetX, eyeOffsetY, eyeRadius * 2);
      // 口: 笑顔
      context.beginPath();
      context.arc(0, radius * 0.1, radius * 0.2, 0, Math.PI, false);
      context.stroke();
      break;

    case 'blackhole':
      // 目: 赤い光
      context.shadowColor = '#ff0000';
      context.shadowBlur = 15;
      context.fillStyle = '#ff3333';
      context.beginPath();
      context.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, 0, 2 * Math.PI);
      context.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, 2 * Math.PI);
      context.fill();
      context.shadowBlur = 0; // リセット
      // 口: 吸い込む「お」
      context.fillStyle = faceColor;
      context.beginPath();
      context.arc(0, radius * 0.15, radius * 0.15, 0, 2 * Math.PI, false);
      context.fill();
      break;

    case 'whitehole':
      // 目: 青い光
      context.shadowColor = '#00ffff';
      context.shadowBlur = 15;
      context.fillStyle = '#ccffff';
      context.beginPath();
      context.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, 0, 2 * Math.PI);
      context.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, 2 * Math.PI);
      context.fill();
      context.shadowBlur = 0;
      // 口: 吐き出す
      context.beginPath();
      context.arc(0, radius * 0.15, radius * 0.15, 0, 2 * Math.PI, false);
      context.stroke();
      break;

    case 'cute':
    default:
      // 通常の可愛い顔
      context.beginPath();
      context.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, 0, 2 * Math.PI);
      context.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, 2 * Math.PI);
      context.fill();
      context.beginPath();
      context.arc(0, radius * 0.1, radius * 0.25, 0, Math.PI, false);
      context.stroke();
      break;
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
    const planet = PLANETS[currentPlanetIndex];
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
  
  // フラッシュエフェクト（超新星爆発）
  if (flashAlpha > 0) {
    context.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
    context.fillRect(0, 0, width, height);
    flashAlpha -= 0.02;
    if (flashAlpha < 0) flashAlpha = 0;
  }
});

function setGameOver() {
  isGameOver = true;
  document.getElementById('game-over-screen').classList.remove('hidden');
  document.getElementById('final-score').innerText = score;
}

// リトライ処理
document.getElementById('retry-btn').addEventListener('click', () => {
  gamesPlayed++;
  if (gamesPlayed % 3 === 0) {
    showInterstitialAd();
  }

  Composite.clear(world);
  Engine.clear(engine);
  Composite.add(world, [ground, leftWall, rightWall]); // 壁を再配置
  
  score = 0;
  scoreEl.innerText = score;
  document.getElementById('app').className = ''; // 背景リセット
  isGameOver = false;
  blackHoles.length = 0;
  whiteHoles.length = 0;
  supermassiveStars.length = 0;
  currentFalling = null;
  document.getElementById('game-over-screen').classList.add('hidden');
  
  currentPlanetIndex = getNextPlanetIndex();
  nextPlanetIndex = getNextPlanetIndex();
  updateNextPreview();
});

// SNSシェア機能
document.getElementById('share-btn').addEventListener('click', () => {
  const shareText = `スコア${score}点で宇宙を創造中！\nブラックホールに吸い込まれた... 🌌\n#PlanetGame\n`;
  const shareUrl = window.location.href;

  if (navigator.share) {
    navigator.share({
      title: 'Planet Game',
      text: shareText,
      url: shareUrl
    }).catch(console.error);
  } else {
    // Web Share APIが使えない環境（PCなど）はXのシェア用URLを開く
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank');
  }
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

// ======================================
// お助けアイテム（SOS）ロジック
// ======================================
const sosBtn = document.getElementById('sos-button');
const sosModal = document.getElementById('sos-modal');
const watchAdBtn = document.getElementById('watch-ad-btn');
const cancelSosBtn = document.getElementById('cancel-sos-btn');

sosBtn.addEventListener('click', () => {
  if (isGameOver) return;
  sosModal.classList.remove('hidden');
  Runner.stop(runner); // 物理演算をポーズ
});

cancelSosBtn.addEventListener('click', () => {
  sosModal.classList.add('hidden');
  if (!isGameOver) {
    Runner.run(runner, engine); // 再開
  }
});

watchAdBtn.addEventListener('click', () => {
  sosModal.classList.add('hidden');
  if (!isGameOver) {
    Runner.run(runner, engine); // 物理演算再開
  }
  // 広告を表示
  showRewardVideoAd();
});
