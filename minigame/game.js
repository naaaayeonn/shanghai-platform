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

/* ───── 사진 이미지 로드 ───── */
// 같은 폴더에 photo.jpg 를 넣어두면 자동으로 동그라미 안에 표시됨
const playerImg = new Image();
playerImg.src = 'ny.jpg';

/* ───── 장애물 데이터 (r = 반지름, 원형으로 굴러옴) ───── */
const OBSTACLE_TYPES = [
  { emoji: '👊', label: '세인소미와\n손절', color: '#E24B4A', r: 28 },
  { emoji: '💸', label: '돈 없음',        color: '#BA7517', r: 26 },
  { emoji: '🌪', label: '번아웃',         color: '#8B5CF6', r: 30 },
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
      cx: W + 60,                  // 원 중심 x (x = cx, 편의용)
      cy: GROUND - o.r,            // 원 중심 y = 바닥에서 반지름만큼 위
      r: o.r,
      emoji: o.emoji,
      label: o.label,
      color: o.color,
      angle: 0,                    // 굴러오는 회전 각도
    });
    // 시작: 0.9~1.4초 간격 → 시간 지날수록 최소 0.4초까지 줄어듦
    spawnTimer = 0.9 + Math.random() * 0.5 - Math.min(elapsed * 0.015, 0.5);
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
  for (const o of obstacles) {
    const dx = speed * dt;
    o.cx -= dx;
    o.x = o.cx;                        // x는 cx 동기화 (필터용)
    o.angle -= dx / o.r;               // 굴러오는 회전: 거리/반지름 = 라디안
  }
  for (const f of foods)     { f.x -= speed * dt; f.spin += dt * 3; }
  obstacles = obstacles.filter(o => o.cx > -100);
  foods     = foods.filter(f => f.x > -100);
  for (const c of clouds)    { c.x -= c.s * speed * 0.07 * dt; if (c.x < -80) c.x = W + 60; }
  for (const b of buildings) { b.x -= speed * 0.06 * dt; if (b.x < -b.w) b.x = W + b.w; }
  bgX -= speed * 0.03 * dt;

  // ── 충돌 감지 ──
  // 플레이어를 원으로 근사: 몸통 중심 + 반지름
  const plCx = player.x + player.w / 2;
  const plCy = player.y - player.h * 0.5;  // 몸통 중심
  const plR  = player.h * 0.3;             // 히트 반지름 (넉넉하게 작게)

  // 장애물: 원-원 거리 충돌
  for (const o of obstacles) {
    const dx = plCx - o.cx;
    const dy = plCy - o.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < plR + o.r - 4) {   // -4는 약간의 관용치
      endGame();
      return;
    }
  }

  // 음식 수집 (AABB로 충분)
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

  // ── 플레이어(나연) ── player.y = 발 바닥
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

/* ───── 플레이어 그리기 (동그란 사진) ───── */
function drawNayeon(x, y, w, h, frame) {
  const cx = x + w / 2;
  const cy = y + h * 0.5;   // 원 중심 (몸통 중심)
  const r  = h * 0.3;       // 원 반지름

  ctx.save();

  // 달리기 bounce: 지면에서 위아래로 살짝 튐
  const bounce = player.onGround ? Math.sin(player.animT * 14) * 2.5 : 0;

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, player.y + 3, r * 0.8, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 다리 (원 아래에서 뻗어나옴)
  const legOff = player.onGround ? Math.sin(player.frame * Math.PI / 2) * 7 : 0;
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  // 왼발
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy + r - bounce + 4);
  ctx.lineTo(cx - 10 + legOff, player.y);
  ctx.stroke();
  // 오른발
  ctx.beginPath();
  ctx.moveTo(cx + 8, cy + r - bounce + 4);
  ctx.lineTo(cx + 10 - legOff, player.y);
  ctx.stroke();

  // 신발
  ctx.fillStyle = '#7c3aed';
  ctx.beginPath(); ctx.ellipse(cx - 10 + legOff, player.y, 10, 5,  0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 10 - legOff, player.y, 10, 5, -0.2, 0, Math.PI * 2); ctx.fill();

  // 팔 (원 옆에서 뻗어나옴)
  const armOff = player.onGround ? Math.sin(player.frame * Math.PI / 2 + 1) * 5 : 0;
  ctx.strokeStyle = '#c4b5fd';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx - r + 4, cy - bounce);
  ctx.lineTo(cx - r - 10, cy + 10 + armOff);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + r - 4, cy - bounce);
  ctx.lineTo(cx + r + 10, cy + 10 - armOff);
  ctx.stroke();

  // 원형 클립 영역
  ctx.beginPath();
  ctx.arc(cx, cy - bounce, r, 0, Math.PI * 2);
  ctx.clip();

  // 사진이 로드됐으면 사진, 아니면 기본 얼굴
  if (playerImg.complete && playerImg.naturalWidth > 0) {
    ctx.drawImage(playerImg, cx - r, cy - r - bounce, r * 2, r * 2);
  } else {
    // photo.jpg 없을 때 기본 얼굴
    ctx.fillStyle = '#fde8d8';
    ctx.fillRect(cx - r, cy - r - bounce, r * 2, r * 2);
    ctx.fillStyle = '#2d1a00';
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.3 - bounce, r * 0.9, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - bounce, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.3, cy - bounce, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c0665a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.15 - bounce, r * 0.2, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  ctx.restore();

  // 원 테두리 (클립 바깥에서 그려야 해서 restore 후)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy - bounce, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

/* ───── 장애물 그리기 (원형, 굴러옴) ───── */
function drawObstacle(o) {
  ctx.save();
  ctx.translate(o.cx, o.cy);
  ctx.rotate(o.angle);   // 원 중심 기준 회전 → 굴러오는 느낌

  // 원 본체
  ctx.beginPath();
  ctx.arc(0, 0, o.r, 0, Math.PI * 2);
  ctx.fillStyle = o.color;
  ctx.shadowColor = o.color;
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.shadowBlur = 0;

  // 굴러가는 느낌을 주는 선 (2개)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-o.r, 0);
  ctx.lineTo(o.r, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -o.r);
  ctx.lineTo(0, o.r);
  ctx.stroke();

  // 원 테두리
  ctx.beginPath();
  ctx.arc(0, 0, o.r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 이모지 (회전 상관없이 항상 정방향으로 보이게 역회전)
  ctx.rotate(-o.angle);
  ctx.font = `${o.r}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(o.emoji, 0, -o.r * 0.1);

  // 라벨 (원 아래쪽)
  ctx.font = `bold ${Math.max(9, o.r * 0.32)}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  const lines = o.label.split('\n');
  lines.forEach((line, i) => {
    ctx.fillText(line, 0, o.r * 0.45 + i * (o.r * 0.38));
  });

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
