/* ================================================
   나연의 상하이 여행 - 게임 로직
   ================================================ */

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('sc');
const msgEl = document.getElementById('msg');
const screenEl = document.getElementById('screen');

/* ───── 캔버스 리사이즈 ───── */
let W, H, GROUND;
const DPR = window.devicePixelRatio || 1;

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.scale(DPR, DPR);
  GROUND = H * 0.72;
}
window.addEventListener('resize', resize);
resize();

/* ───── 게임 상태 변수 ───── */
let state = 'idle';
let score = 0;
let lastTime = 0;
let frameId;
let player, obstacles, foods, clouds, buildings;
let spawnTimer = 0, foodTimer = 0;
let speed = 0, elapsed = 0;
let bgX = 0;

/* ───── 이미지 로드 ───── */
const playerImg = new Image();
playerImg.src = 'ny.jpg';

const obsImgs = [new Image(), new Image(), new Image()];
obsImgs[0].src = 'obs1.jpg';
obsImgs[1].src = 'obs2.jpg';
obsImgs[2].src = 'obs3.jpg';

/* ───── 장애물 데이터 ───── */
const OBSTACLE_TYPES = [
  { label: '세인소미와\n손절', color: '#E24B4A', r: 28, imgIdx: 0 },
  { label: '돈 없음',          color: '#BA7517', r: 26, imgIdx: 1 },
  { label: '번아웃',           color: '#8B5CF6', r: 30, imgIdx: 2 },
];

/* ───── 음식(보너스) 데이터 ───── */
const FOOD_TYPES = [
  { label: '+3s 딤섬',   emoji: '🥟', bonus: 3 },
  { label: '+5s 훠궈',   emoji: '🍲', bonus: 5 },
  { label: '+2s 밀크티', emoji: '🧋', bonus: 2 },
];

/* ───── 게임 초기화 ───── */
function initGame() {
  player = {
    x: W * 0.18,
    y: GROUND,
    vy: 0,
    w: 60,
    h: 60,
    onGround: true,
    frame: 0,
    animT: 0,
    jumpCount: 0,
  };
  obstacles = [];
  foods = [];
  clouds = [];
  buildings = [];
  spawnTimer = 0;
  foodTimer = 0;
  speed = 220;
  elapsed = 0;
  score = 0;
  bgX = 0;

  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * W,
      y: H * 0.08 + Math.random() * H * 0.22,
      r: 20 + Math.random() * 30,
      s: 0.3 + Math.random() * 0.4,
    });
  }
  for (let i = 0; i < 5; i++) {
    buildings.push({
      x: i * (W / 4.5),
      w: W / 5 + Math.random() * W * 0.08,
      h: H * 0.18 + Math.random() * H * 0.2,
      color: i % 2 === 0 ? '#1e3a5f' : '#2d1b4e',
    });
  }
}

/* ───── 게임 시작 ───── */
function startGame() {
  screenEl.style.display = 'none';
  initGame();
  state = 'play';
  lastTime = performance.now();
  cancelAnimationFrame(frameId);
  loop(lastTime);
}

/* ───── 점프 (더블점프 가능) ───── */
function jump() {
  if (state !== 'play') return;
  if (player.jumpCount < 2) {
    player.vy = -560;
    player.onGround = false;
    player.jumpCount++;
  }
}

/* ───── 보너스 메시지 ───── */
function showMsg(text) {
  msgEl.textContent = text;
  msgEl.style.opacity = '1';
  clearTimeout(msgEl._t);
  msgEl._t = setTimeout(() => { msgEl.style.opacity = '0'; }, 1400);
}

/* ───── 게임 종료 ───── */
function endGame() {
  state = 'dead';
  screenEl.style.display = 'flex';
  screenEl.innerHTML = `
    <h1>✈ 여행 종료!</h1>
    <p style="color:#FFD700;font-size:clamp(24px,5vw,38px);font-weight:700;margin:8px 0">${score.toFixed(1)}초</p>
    <p style="color:#eee">상하이 여행이 끝났어요 😢</p>
    <p class="sub" style="color:#aaa;font-size:13px;margin-bottom:24px">장애물에 부딪혔어요!</p>
    <button id="btn" onclick="startGame()">다시 도전!</button>
  `;
}

/* ───── 메인 루프 ───── */
function loop(ts) {
  frameId = requestAnimationFrame(loop);
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  if (state !== 'play') { drawBg(); return; }
  update(dt);
  draw();
}

/* ───── 업데이트 ───── */
function update(dt) {
  elapsed += dt;
  score += dt;
  speed = 220 + elapsed * 8;
  spawnTimer -= dt;
  foodTimer -= dt;

  // 플레이어 물리
  player.vy += 1600 * dt;
  player.y += player.vy * dt;
  if (player.y >= GROUND) {
    player.y = GROUND;
    player.vy = 0;
    player.onGround = true;
    player.jumpCount = 0;
  }
  player.animT += dt;
  player.frame = player.onGround ? Math.floor(player.animT * 8) % 4 : 4;

  // 장애물 스폰
  if (spawnTimer <= 0) {
    const o = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    obstacles.push({
      cx: W + 60,
      cy: GROUND - o.r,
      r: o.r,
      label: o.label,
      color: o.color,
      imgIdx: o.imgIdx,
    });
    spawnTimer = 0.9 + Math.random() * 0.5 - Math.min(elapsed * 0.015, 0.5);
  }

  // 음식 스폰
  if (foodTimer <= 0) {
    const f = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];
    foods.push({
      x: W + 40,
      y: GROUND - (H * 0.14 + Math.random() * H * 0.1),
      w: 40,
      h: 40,
      label: f.label,
      emoji: f.emoji,
      bonus: f.bonus,
      spin: 0,
    });
    foodTimer = 4 + Math.random() * 4;
  }

  // 이동
  for (const o of obstacles) o.cx -= speed * dt;
  for (const f of foods) { f.x -= speed * dt; f.spin += dt * 3; }
  obstacles = obstacles.filter(o => o.cx > -100);
  foods     = foods.filter(f => f.x > -100);
  for (const c of clouds)    { c.x -= c.s * speed * 0.07 * dt; if (c.x < -80) c.x = W + 60; }
  for (const b of buildings) { b.x -= speed * 0.06 * dt; if (b.x < -b.w) b.x = W + b.w; }
  bgX -= speed * 0.03 * dt;

  // 충돌 감지 - 플레이어 원 중심
  const plR  = player.w / 2;
  const plCx = player.x + plR;
  const plCy = player.y - plR;   // 발에서 반지름만큼 위 = 원 중심

  for (const o of obstacles) {
    const dx = plCx - o.cx;
    const dy = plCy - o.cy;
    if (Math.sqrt(dx * dx + dy * dy) < plR + o.r - 6) {
      endGame();
      return;
    }
  }

  for (let i = foods.length - 1; i >= 0; i--) {
    const f = foods[i];
    const fdx = plCx - (f.x + f.w / 2);
    const fdy = plCy - (f.y + f.h / 2);
    if (Math.sqrt(fdx * fdx + fdy * fdy) < plR + f.w / 2) {
      score += f.bonus;
      showMsg(f.label);
      foods.splice(i, 1);
    }
  }

  scoreEl.textContent = score.toFixed(1);
}

/* ================================================
   그리기 함수들
   ================================================ */

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBg();

  // 바닥
  ctx.fillStyle = '#3a2a6e';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#5a3a8e';
  ctx.fillRect(0, GROUND, W, 6);

  // 바닥 타일
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i < W; i += 60) {
    const bx = (i + bgX * 2) % W;
    ctx.beginPath();
    ctx.moveTo(bx, GROUND + 6);
    ctx.lineTo(bx, H);
    ctx.stroke();
  }

  // 음식
  for (const f of foods) {
    ctx.save();
    ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
    ctx.rotate(Math.sin(f.spin) * 0.25);
    drawFood(0, 0, f.w, f.emoji);
    ctx.restore();
  }

  // 장애물
  for (const o of obstacles) drawObstacle(o);

  // 플레이어
  drawPlayer();
}

/* ───── 배경 ───── */
function drawBg() {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#0f0c29');
  sky.addColorStop(0.5, '#1a1a4e');
  sky.addColorStop(1, '#2d1b69');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  drawBuildings();
  drawOrientalPearl(W * 0.8, GROUND - H * 0.46, H * 0.46);
  drawClouds();
}

/* ───── 빌딩 ───── */
function drawBuildings() {
  for (const b of buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, GROUND - b.h, b.w, b.h);
    ctx.fillStyle = 'rgba(255,240,100,0.25)';
    for (let wy = GROUND - b.h + 10; wy < GROUND - 10; wy += 20) {
      for (let wx = b.x + 8; wx < b.x + b.w - 10; wx += 16) {
        if (Math.random() > 0.35) ctx.fillRect(wx, wy, 8, 10);
      }
    }
  }
}

/* ───── 동방명주 ───── */
function drawOrientalPearl(x, y, maxH) {
  const s = maxH / 240;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(230,80,120,0.85)';
  ctx.strokeStyle = 'rgba(255,100,150,0.7)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.arc(0, maxH * 0.35, 30 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(200,50,100,0.85)';
  ctx.beginPath(); ctx.arc(0, maxH * 0.6, 18 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,100,150,0.6)';
  ctx.lineWidth = 3 * s;
  ctx.beginPath(); ctx.moveTo(-22 * s, maxH * 0.78); ctx.lineTo(-8 * s, maxH * 0.55); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22 * s, maxH * 0.78);  ctx.lineTo(8 * s,  maxH * 0.55); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,150,180,0.8)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.moveTo(0, maxH * 0.2); ctx.lineTo(0, 0); ctx.stroke();
  ctx.fillStyle = '#FFD700';
  ctx.beginPath(); ctx.arc(0, 0, 4 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ───── 구름 ───── */
function drawClouds() {
  for (const c of clouds) {
    ctx.fillStyle = 'rgba(150,100,200,0.2)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.arc(c.x + c.r * 0.7, c.y + 4, c.r * 0.65, 0, Math.PI * 2);
    ctx.arc(c.x - c.r * 0.6, c.y + 6, c.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ───── 플레이어 (원형 사진) ───── */
function drawPlayer() {
  const r   = player.w / 2;
  const cx  = player.x + r;
  const cy  = player.y - r;   // 발에서 반지름만큼 위
  const bounce = player.onGround ? Math.sin(player.animT * 14) * 2.5 : 0;

  // 그림자
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, player.y + 3, r * 0.8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 원형 클립 + 사진
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy - bounce, r, 0, Math.PI * 2);
  ctx.clip();
  if (playerImg.complete && playerImg.naturalWidth > 0) {
    ctx.drawImage(playerImg, cx - r, cy - r - bounce, r * 2, r * 2);
  } else {
    ctx.fillStyle = '#fde8d8';
    ctx.fillRect(cx - r, cy - r - bounce, r * 2, r * 2);
  }
  ctx.restore();

  // 금색 테두리
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy - bounce, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

/* ───── 장애물 (원형 사진) ───── */
function drawObstacle(o) {
  // 배경 색 + 클립
  ctx.save();
  ctx.beginPath();
  ctx.arc(o.cx, o.cy, o.r, 0, Math.PI * 2);
  ctx.fillStyle = o.color;
  ctx.shadowColor = o.color;
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.clip();

  const img = obsImgs[o.imgIdx];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, o.cx - o.r, o.cy - o.r, o.r * 2, o.r * 2);
  }
  ctx.restore();

  // 테두리
  ctx.save();
  ctx.beginPath();
  ctx.arc(o.cx, o.cy, o.r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // 라벨 (원 아래)
  ctx.save();
  ctx.font = `bold ${Math.max(9, o.r * 0.32)}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  o.label.split('\n').forEach((line, i) => {
    ctx.fillText(line, o.cx, o.cy + o.r + 4 + i * (o.r * 0.38));
  });
  ctx.restore();
}

/* ───── 음식 (이모지만) ───── */
function drawFood(x, y, size, emoji) {
  ctx.font = `${size * 0.9}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y);
}

/* ───── 컨트롤 ───── */
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
});
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  jump();
}, { passive: false });

/* ───── 최초 렌더 ───── */
resize();
drawBg();
