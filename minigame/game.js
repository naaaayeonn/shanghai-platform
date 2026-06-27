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
let state = 'idle';   // 'idle' | 'play' | 'dead'
let score = 0;
let lastTime = 0;
let frameId;
let player, obstacles, foods, clouds, buildings;
let spawnTimer = 0, foodTimer = 0;
let speed = 0, elapsed = 0;
let bgX = 0;

/* ───── 장애물 데이터 ───── */
const OBSTACLE_TYPES = [
  { label: '👊 친구와의 싸움', color: '#E24B4A', w: 48, h: 56 },
  { label: '💸 돈 없음',       color: '#BA7517', w: 52, h: 52 },
  { label: '🌪 번아웃',        color: '#8B5CF6', w: 44, h: 60 },
];

/* ───── 음식(보너스) 데이터 ───── */
// bonus: 추가되는 초(seconds)
const FOOD_TYPES = [
  { label: '+3s 🥟 딤섬',   color: '#F59E0B', bonus: 3 },
  { label: '+5s 🍲 훠궈',   color: '#EF4444', bonus: 5 },
  { label: '+2s 🧋 밀크티', color: '#A78BFA', bonus: 2 },
];

/* ───── 게임 초기화 ───── */
function initGame() {
  player = {
    x: W * 0.18,
    y: GROUND,
    vy: 0,
    w: 34,
    h: 52,
    onGround: true,
    frame: 0,
    animT: 0,
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

  // 구름 초기 배치
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * W,
      y: H * 0.08 + Math.random() * H * 0.22,
      r: 20 + Math.random() * 30,
      s: 0.3 + Math.random() * 0.4,
    });
  }

  // 빌딩 초기 배치
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

/* ───── 점프 ───── */
function jump() {
  if (state === 'play' && player.onGround) {
    player.vy = -560;
    player.onGround = false;
  }
}

/* ───── 보너스 메시지 표시 ───── */
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

  if (state !== 'play') {
    drawBg();
    return;
  }
  update(dt);
  draw();
}

/* ───── 업데이트 ───── */
function update(dt) {
  elapsed += dt;
  score += dt;

  // 시간이 지날수록 속도 증가
  speed = 220 + elapsed * 8;

  // 장애물 스폰 타이머
  spawnTimer -= dt;
  foodTimer -= dt;

  // ── 플레이어 물리 ──
  player.vy += 1600 * dt;  // 중력
  player.y += player.vy * dt;
  if (player.y >= GROUND) {
    player.y = GROUND;
    player.vy = 0;
    player.onGround = true;
  }

  // 달리기 애니메이션 프레임
  player.animT += dt;
  if (player.onGround) {
    player.frame = Math.floor(player.animT * 8) % 4;
  } else {
    player.frame = 4; // 점프 자세
  }

  // ── 장애물 스폰 ──
  if (spawnTimer <= 0) {
    const o = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    obstacles.push({
      x: W + 60,
      y: GROUND + player.h - o.h,
      w: o.w,
      h: o.h,
      label: o.label,
      color: o.color,
    });
    // 시간이 지날수록 스폰 간격 짧아짐
    spawnTimer = 1.4 + Math.random() * 1.1 - Math.min(elapsed * 0.012, 0.6);
  }

  // ── 음식 스폰 ──
  if (foodTimer <= 0) {
    const f = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];
    foods.push({
      x: W + 40,
      y: GROUND - (H * 0.14 + Math.random() * H * 0.1),
      w: 36,
      h: 36,
      label: f.label,
      bonus: f.bonus,
      color: f.color,
      spin: 0,
    });
    foodTimer = 4 + Math.random() * 4;
  }

  // ── 이동 ──
  for (const o of obstacles) o.x -= speed * dt;
  for (const f of foods)     { f.x -= speed * dt; f.spin += dt * 3; }
  obstacles = obstacles.filter(o => o.x > -100);
  foods     = foods.filter(f => f.x > -100);
  for (const c of clouds)    { c.x -= c.s * speed * 0.07 * dt; if (c.x < -80) c.x = W + 60; }
  for (const b of buildings) { b.x -= speed * 0.06 * dt; if (b.x < -b.w) b.x = W + b.w; }
  bgX -= speed * 0.03 * dt;

  // ── 충돌 감지 ──
  const px = player.x,       py = player.y - player.h + 6;
  const pw = player.w - 8,   ph = player.h - 10;

  // 장애물 충돌
  for (const o of obstacles) {
    if (px + pw > o.x + 6 && px < o.x + o.w - 6 &&
        py + ph > o.y + 6 && py < o.y + o.h - 6) {
      endGame();
      return;
    }
  }

  // 음식 수집
  for (let i = foods.length - 1; i >= 0; i--) {
    const f = foods[i];
    if (px + pw > f.x + 4 && px < f.x + f.w - 4 &&
        py + ph > f.y + 4 && py < f.y + f.h - 4) {
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

  // ── 바닥 ──
  ctx.fillStyle = '#3a2a6e';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#5a3a8e';
  ctx.fillRect(0, GROUND, W, 6);

  // 바닥 타일 패턴
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i < W; i += 60) {
    const bx = (i + bgX * 2) % W;
    ctx.beginPath();
    ctx.moveTo(bx, GROUND + 6);
    ctx.lineTo(bx, H);
    ctx.stroke();
  }

  // ── 음식 아이템 ──
  for (const f of foods) {
    ctx.save();
    ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
    ctx.rotate(Math.sin(f.spin) * 0.18);
    drawFood(0, 0, f.w, f.color);
    ctx.restore();
  }

  // ── 장애물 ──
  for (const o of obstacles) drawObstacle(o);

  // ── 플레이어(나연) ──
  drawNayeon(player.x, player.y - player.h, player.w, player.h, player.frame);
}

/* ───── 배경 그리기 ───── */
function drawBg() {
  // 하늘 그라데이션
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

    // 창문
    ctx.fillStyle = 'rgba(255,240,100,0.25)';
    for (let wy = GROUND - b.h + 10; wy < GROUND - 10; wy += 20) {
      for (let wx = b.x + 8; wx < b.x + b.w - 10; wx += 16) {
        if (Math.random() > 0.35) ctx.fillRect(wx, wy, 8, 10);
      }
    }
  }
}

/* ───── 동방명주 타워 (심플 일러스트) ───── */
function drawOrientalPearl(x, y, maxH) {
  const s = maxH / 240;
  ctx.save();
  ctx.translate(x, y);

  // 큰 구체
  ctx.fillStyle = 'rgba(230,80,120,0.85)';
  ctx.strokeStyle = 'rgba(255,100,150,0.7)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(0, maxH * 0.35, 30 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 작은 구체
  ctx.fillStyle = 'rgba(200,50,100,0.85)';
  ctx.beginPath();
  ctx.arc(0, maxH * 0.6, 18 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 다리(기둥)
  ctx.strokeStyle = 'rgba(200,100,150,0.6)';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(-22 * s, maxH * 0.78);
  ctx.lineTo(-8 * s, maxH * 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(22 * s, maxH * 0.78);
  ctx.lineTo(8 * s, maxH * 0.55);
  ctx.stroke();

  // 첨탑
  ctx.strokeStyle = 'rgba(255,150,180,0.8)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(0, maxH * 0.2);
  ctx.lineTo(0, 0);
  ctx.stroke();

  // 안테나 끝 점
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(0, 0, 4 * s, 0, Math.PI * 2);
  ctx.fill();

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

/* ───── 나연 캐릭터 ───── */
function drawNayeon(x, y, w, h, frame) {
  ctx.save();
  ctx.translate(x + w / 2, y);

  const legOff = player.onGround ? Math.sin(frame * Math.PI / 2) * 8 : 0;
  const armOff = player.onGround ? Math.sin(frame * Math.PI / 2 + 1) * 6 : 0;

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, h + 2, w * 0.45, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 다리
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-5, h * 0.65); ctx.lineTo(-7 + legOff, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 5, h * 0.65); ctx.lineTo( 7 - legOff, h); ctx.stroke();

  // 신발
  ctx.fillStyle = '#7c3aed';
  ctx.beginPath(); ctx.ellipse(-7 + legOff, h, 10, 5,  0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 7 - legOff, h, 10, 5, -0.2, 0, Math.PI * 2); ctx.fill();

  // 몸통 (후드티)
  ctx.fillStyle = '#c4b5fd';
  roundRect(-w * 0.3, h * 0.38, w * 0.6, h * 0.32, 6);
  ctx.fill();

  // 주머니 디테일
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(-9, h * 0.52, 18, 10, 3);
  ctx.fill();

  // 팔
  ctx.strokeStyle = '#c4b5fd';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-w * 0.28, h * 0.42); ctx.lineTo(-w * 0.38 - armOff, h * 0.62); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( w * 0.28, h * 0.42); ctx.lineTo( w * 0.38 + armOff, h * 0.62); ctx.stroke();

  // 목
  ctx.fillStyle = '#fde8d8';
  ctx.fillRect(-5, h * 0.28, 10, h * 0.14);

  // 얼굴
  ctx.fillStyle = '#fde8d8';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.2, w * 0.32, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 머리카락
  ctx.fillStyle = '#2d1a00';
  ctx.beginPath(); ctx.ellipse(0,       h * 0.11, w * 0.32, h * 0.14,  0,    Math.PI, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-w*0.28, h * 0.22, 8, 12,  0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( w*0.28, h * 0.22, 8, 12, -0.3, 0, Math.PI * 2); ctx.fill();

  // 눈
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(-7, h * 0.19, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 7, h * 0.19, 3, 0, Math.PI * 2); ctx.fill();

  // 눈 하이라이트
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-6, h * 0.18, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 8, h * 0.18, 1, 0, Math.PI * 2); ctx.fill();

  // 미소
  ctx.strokeStyle = '#c0665a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, h * 0.23, 5, 0.1, Math.PI - 0.1);
  ctx.stroke();

  ctx.restore();
}

/* ───── 장애물 그리기 ───── */
function drawObstacle(o) {
  ctx.save();
  ctx.translate(o.x + o.w / 2, o.y + o.h / 2);

  const pulse = Math.sin(Date.now() * 0.005) * 2;

  ctx.fillStyle = o.color;
  ctx.shadowColor = o.color;
  ctx.shadowBlur = 12 + pulse;
  roundRect(-o.w / 2, -o.h / 2 + pulse / 2, o.w, o.h - pulse, 10);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 아이콘 배경
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  roundRect(-o.w / 2 + 4, -o.h / 2 + 4, o.w - 8, o.w - 8, 6);
  ctx.fill();

  // 이모지
  const emoji = o.label.split(' ')[0];
  ctx.font = `${o.w * 0.5}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 0, -o.h * 0.17);

  // 라벨 텍스트
  ctx.font = 'bold 9px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const words = o.label.replace(emoji + ' ', '').split(' ');
  ctx.fillText(words.slice(0, 2).join(' '), 0,  o.h * 0.28);
  if (words.length > 2) ctx.fillText(words.slice(2).join(' '), 0, o.h * 0.42);

  ctx.restore();
}

/* ───── 음식 그리기 ───── */
function drawFood(x, y, size, color) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `${size * 0.55}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🥟', x, y);
}

/* ───── 헬퍼: 둥근 사각형 ───── */
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

/* ───── 컨트롤 (키보드 & 터치) ───── */
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    jump();
  }
});
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  jump();
}, { passive: false });

/* ───── 최초 배경 렌더 ───── */
resize();
drawBg();
