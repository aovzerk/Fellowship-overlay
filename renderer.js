const playersContainer = document.getElementById("playersContainer");
const pickFileBtn = document.getElementById("pickFileBtn");
const reloadBtn = document.getElementById("reloadBtn");
const toggleLockBtn = document.getElementById("toggleLockBtn");
const minimizeToTrayBtn = document.getElementById("minimizeToTrayBtn");
const closeAppBtn = document.getElementById("closeAppBtn");
const filePathEl = document.getElementById("filePath");
const watchStatusEl = document.getElementById("watchStatus");
const hudStatusEl = document.getElementById("hudStatus");
const overlayRoot = document.getElementById("overlay-root");

const STORAGE_KEY = "overlay-player-positions-v2";
let overlayLocked = false;
let latestData = null;
const cardMap = new Map();
let cooldownTimer = null;
let hudActive = true;

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDurationMs(ms) {
  const totalSeconds = Math.max(0, Math.ceil((ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getPlayerLayoutKey(slotIndex = 0) {
  return `party-slot:${slotIndex}`;
}

function getPartySlotIndex(player, index = 0) {
  const partyIds = latestData?.partyPlayerIds || [];
  const byPartyOrder = Array.isArray(partyIds) ? partyIds.indexOf(player?.id) : -1;
  if (byPartyOrder >= 0) return byPartyOrder;
  return index;
}

function loadPositions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePositions(positions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

function getDefaultPosition(index) {
  return { x: 16, y: 64 + index * 122 };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setHudActiveState(active, foregroundExe = null) {
  hudActive = !!active;
  overlayRoot.classList.toggle('hud-hidden', !hudActive);
  const suffix = foregroundExe ? ` (${foregroundExe})` : '';
  hudStatusEl.textContent = hudActive ? 'HUD active' : `HUD hidden${suffix}`;
}

function makeCardDraggable(card, dragHandle, _layoutKey, positions) {
  let dragging = false;
  let startMouseX = 0;
  let startMouseY = 0;
  let startLeft = 0;
  let startTop = 0;

  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;
    const maxX = Math.max(0, window.innerWidth - card.offsetWidth - 6);
    const maxY = Math.max(0, window.innerHeight - card.offsetHeight - 6);
    const left = clamp(startLeft + dx, 0, maxX);
    const top = clamp(startTop + dy, 0, maxY);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    const layoutKey = card.dataset.layoutKey || getPlayerLayoutKey(0);
    positions[layoutKey] = { x: left, y: top };
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    savePositions(positions);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  }

  dragHandle.addEventListener("mousedown", (e) => {
    if (!overlayLocked) return;
    dragging = true;
    startMouseX = e.clientX;
    startMouseY = e.clientY;
    startLeft = parseFloat(card.style.left || "0");
    startTop = parseFloat(card.style.top || "0");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    e.preventDefault();
    e.stopPropagation();
  });
}

function createCard(player, slotIndex, positions) {
  const layoutKey = getPlayerLayoutKey(slotIndex);
  const pos = positions[layoutKey] || getDefaultPosition(slotIndex);
  const card = document.createElement("div");
  card.className = "panel player-card interactive floating-card";
  card.dataset.playerId = player.id || '';
  card.dataset.layoutKey = layoutKey;
  card.style.left = `${pos.x}px`;
  card.style.top = `${pos.y}px`;
  card.innerHTML = `
    <div class="player-header drag-handle">
      <div>
        <div class="player-name"></div>
        <div class="player-class"></div>
      </div>
      <span class="spirit-total">-</span>
    </div>
    <div class="spirit-row">
      <div>Spirit</div>
      <div class="bar-wrap"><div class="bar"></div></div>
      <div class="spirit-percent">0%</div>
    </div>
    <div class="relics-block"></div>
    <div class="meta"></div>
  `;
  makeCardDraggable(card, card.querySelector('.drag-handle'), layoutKey, positions);
  playersContainer.appendChild(card);
  cardMap.set(player.id, card);
  return card;
}

function updateRelicNodes(container, relics) {
  const existing = new Map([...container.children].map((node) => [node.dataset.id, node]));
  const fragment = document.createDocumentFragment();

  for (const relic of relics) {
    const key = String(relic.id);
    let row = existing.get(key);
    if (!row) {
      row = document.createElement('div');
      row.className = 'relic-chip';
      row.dataset.id = key;
      row.innerHTML = `
        <img class="relic-icon" alt="" />
        <div class="relic-info">
          <div class="relic-name"></div>
          <div class="relic-timer"></div>
        </div>
      `;
    }
    row.classList.toggle('ready', relic.isReady);
    row.classList.toggle('cooldown', !relic.isReady);
    const icon = row.querySelector('.relic-icon');
    icon.src = `./${escapeHtml(relic.icon || 'icons_trink/empty.png')}`;
    icon.alt = escapeHtml(relic.name);
    row.querySelector('.relic-name').textContent = relic.name;
    row.querySelector('.relic-timer').textContent = relic.isReady ? 'Ready' : formatDurationMs(relic.cooldownRemainingMs);
    fragment.appendChild(row);
    existing.delete(key);
  }

  container.innerHTML = '';
  container.appendChild(fragment);
}

function updateCard(card, player) {
  const history = player.spiritHistory || [];
  const last = history[history.length - 1];
  const percent = last?.max ? Math.max(0, Math.min(100, (last.current / last.max) * 100)) : 0;
  const classColor = player.classColor || '#6b7280';

  card.dataset.playerId = player.id || '';
  card.querySelector('.player-name').textContent = player.name || 'Unknown';
  card.querySelector('.player-class').textContent = `${player.className || 'Unknown'}${player.classId != null ? `` : ''}`;
  card.querySelector('.player-class').style.color = classColor;
  card.querySelector('.spirit-total').textContent = last ? `${formatNumber(last.current)} / ${formatNumber(last.max)}` : '-';
  card.querySelector('.bar').style.width = `${percent}%`;
  card.querySelector('.bar').style.backgroundColor = classColor;
  card.querySelector('.spirit-percent').textContent = `${formatNumber(percent)}%`;
  card.querySelector('.meta').textContent = `Damage: ${formatNumber(player.damageDone)} | Heal: ${formatNumber(player.healingDone)} | Deaths: ${formatNumber(player.deaths)}`;
  updateRelicNodes(card.querySelector('.relics-block'), player.relics || []);
}

function renderPlayers(players = []) {
  const positions = loadPositions();
  const activeIds = new Set(players.map((player) => player.id));

  for (const [playerId, card] of cardMap.entries()) {
    if (!activeIds.has(playerId)) {
      card.remove();
      cardMap.delete(playerId);
    }
  }

  players.forEach((player, index) => {
    const slotIndex = getPartySlotIndex(player, index);
    const layoutKey = getPlayerLayoutKey(slotIndex);
    let card = cardMap.get(player.id);

    if (!card) {
      card = createCard(player, slotIndex, positions);
    }

    if (card.dataset.layoutKey !== layoutKey) {
      const previousLayoutKey = card.dataset.layoutKey;
      const currentLeft = parseFloat(card.style.left || '0');
      const currentTop = parseFloat(card.style.top || '0');
      if (previousLayoutKey && !positions[layoutKey] && Number.isFinite(currentLeft) && Number.isFinite(currentTop)) {
        positions[layoutKey] = { x: currentLeft, y: currentTop };
        savePositions(positions);
      }

      card.dataset.layoutKey = layoutKey;
      const savedPos = positions[layoutKey] || getDefaultPosition(slotIndex);
      card.style.left = `${savedPos.x}px`;
      card.style.top = `${savedPos.y}px`;
    }

    updateCard(card, player);
  });
}

function tickCooldowns() {
  if (!latestData?.players?.length) return;
  const now = Date.now();
  latestData.players.forEach((player) => {
    const card = cardMap.get(player.id);
    if (!card || !player.relics?.length) return;
    player.relics.forEach((relic) => {
      if (!relic.cooldownEndsAt) return;
      const endMs = Date.parse(relic.cooldownEndsAt);
      relic.cooldownRemainingMs = Number.isFinite(endMs) ? Math.max(0, endMs - now) : 0;
      relic.isReady = relic.cooldownRemainingMs <= 0;
    });
    updateRelicNodes(card.querySelector('.relics-block'), player.relics);
  });
}

pickFileBtn.addEventListener("click", async () => {
  const result = await window.api.pickLogFile();
  if (!result?.canceled && result?.filePath) filePathEl.textContent = result.filePath;
});

reloadBtn.addEventListener("click", async () => {
  await window.api.reloadCurrentFile();
});

toggleLockBtn.addEventListener("click", async () => {
  await window.api.toggleOverlayLock();
});

minimizeToTrayBtn.addEventListener("click", async () => {
  await window.api.minimizeToTray();
});

closeAppBtn.addEventListener("click", async () => {
  await window.api.quitApp();
});

window.api.onWatchStatus((payload) => {
  watchStatusEl.textContent = payload?.message || "Нет слежения";
});

window.api.onOverlayMode((payload) => {
  overlayLocked = !!payload?.locked;
  toggleLockBtn.textContent = overlayLocked ? "Unlock overlay" : "Lock overlay";
});

window.api.onHudState((payload) => {
  setHudActiveState(payload?.active, payload?.foregroundExe || null);
});

window.api.onLogData((payload) => {
  if (!payload?.ok) {
    playersContainer.innerHTML = `<div class="panel player-card interactive floating-card" style="left:16px;top:64px;">Ошибка: ${escapeHtml(payload?.error || "unknown")}</div>`;
    cardMap.clear();
    return;
  }

  latestData = payload.data;
  filePathEl.textContent = payload.filePath || "Файл не выбран";
  renderPlayers(latestData.players || []);

  if (!cooldownTimer) {
    cooldownTimer = setInterval(tickCooldowns, 1000);
  }
});
