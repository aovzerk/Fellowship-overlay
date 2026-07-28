(() => {
  const { escapeHtml, formatDurationMs, toAssetSrc } = window.OverlayRendererFormatters;
  const { getScaledMetrics } = window.OverlayRendererLayout;

  type DisplayIcon = PlayerRelicState & {
    key: string;
    originalCooldown?: number;
  };

  type CooldownAccelerationEffect = {
    abilityId: number;
    durationMs: number;
    speedBonus: number;
  };

  type CooldownAccelerationWindow = {
    startMs: number;
    endMs: number;
    speedBonus: number;
  };

  const PARTY_GROUP_KEY = 'party-group';
  const RELICS_ORDER_TOKEN = '__relics__';
  const TANK_CLASS_IDS = new Set([22, 13, 25]);
  const HEALER_CLASS_IDS = new Set([24, 14, 20]);
  const GUNDE_CLASS_ID = 9;
  const SYLVIE_CLASS_ID = 14;
  const COOLDOWN_ACCELERATION_EFFECTS: CooldownAccelerationEffect[] = [
    { abilityId: 1558, durationMs: 3000, speedBonus: 8 },
    { abilityId: 160, durationMs: 6000, speedBonus: 2 },
  ];

  function isSylvieClass(player: PlayerState): boolean {
    return Number(player?.classId) === SYLVIE_CLASS_ID
      || String(player?.className || '').trim().toLowerCase() === 'sylvie';
  }

  function getDisplayedShrooms(player: PlayerState, nowMs: number): {
    fresh: number;
    medium: number;
    expiring: number;
    upcoming: number;
  } {
    const timeline = Array.isArray(player.shrooms?.timeline) ? player.shrooms.timeline : [];
    if (!timeline.length) {
      return {
        fresh: Math.max(0, Number(player.shrooms?.fresh || 0)),
        medium: Math.max(0, Number(player.shrooms?.medium || 0)),
        expiring: Math.max(0, Number(player.shrooms?.expiring || 0)),
        upcoming: Math.max(0, Number(player.shrooms?.upcoming || 0)),
      };
    }
    let fresh = 0;
    let medium = 0;
    let expiring = 0;
    let upcoming = 0;
    timeline.forEach((entry) => {
      const matureAtMs = Number(entry?.matureAtMs);
      const expiresAtMs = Number(entry?.expiresAtMs);
      if (!Number.isFinite(matureAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return;
      if (matureAtMs > nowMs) {
        upcoming += 1;
        return;
      }
      const remainingMs = expiresAtMs - nowMs;
      if (remainingMs >= 30_000) fresh += 1;
      else if (remainingMs >= 10_000) medium += 1;
      else expiring += 1;
    });
    return { fresh, medium, expiring, upcoming };
  }

  function updateIconNodes(container: HTMLElement, items: DisplayIcon[]): void {
    const existing = new Map<string, HTMLElement>();
    container.querySelectorAll<HTMLElement>('.relic-chip').forEach((node) => {
      existing.set(String(node.dataset.key || ''), node);
    });

    const fragment = document.createDocumentFragment();

    for (const item of items) {
      const key = String(item.key || item.id);
      let row = existing.get(key);
      if (!row) {
        row = document.createElement('div');
        row.className = 'relic-chip';
        row.dataset.key = key;
        row.innerHTML = `
          <img class="relic-icon" alt="" />
          <div class="relic-cooldown-mask"></div>
          <div class="relic-cooldown-hand"></div>
          <div class="relic-timer"></div>
        `;
      }
      row.classList.toggle('ready', item.isReady);
      row.classList.toggle('cooldown', !item.isReady);

      const icon = row.querySelector<HTMLImageElement>('.relic-icon');
      const timer = row.querySelector<HTMLElement>('.relic-timer');
      if (!icon || !timer) continue;

      icon.src = toAssetSrc(item.icon || 'game-data/relics/empty.jpg');
      icon.alt = escapeHtml(item.name);
      row.title = item.name || '';

      const baseCooldownMs = Math.max(0, Number(item.effectiveCooldown || item.baseCooldown || 0) * 1000);
      const remainingMs = Math.max(0, Number(item.cooldownRemainingMs || 0));
      const progress = item.isReady || !baseCooldownMs ? 1 : Math.max(0, Math.min(1, 1 - (remainingMs / baseCooldownMs)));
      const angle = progress * 360;

      row.style.setProperty('--cooldown-progress', `${angle}deg`);
      timer.textContent = item.isReady ? '' : formatDurationMs(remainingMs);

      fragment.appendChild(row);
      existing.delete(key);
    }

    container.innerHTML = '';
    container.appendChild(fragment);
  }


  function getEffectiveNowMs(latestData: FinalizedState | null): number {
    const correctedClientNowMs = Date.now() + Number(latestData?.timeCorrectionMs || 0);
    const latestLogTsMs = Date.parse(String(latestData?.latestLogTs || ''));
    return Math.max(correctedClientNowMs, Number.isFinite(latestLogTsMs) ? latestLogTsMs : 0);
  }

  function isGundeClass(player: PlayerState): boolean {
    return Number(player?.classId || 0) === GUNDE_CLASS_ID
      || String(player?.className || '').trim().toLowerCase() === 'gunde';
  }

  function getSpiritMaxByBlueStone(blueStone: unknown): number {
    const blue = Number(blueStone || 0);
    if (blue >= 600) return 130;
    if (blue >= 100) return 110;
    return 100;
  }

  function buildDisplayedSpiritSnapshot(player: PlayerState, spiritSnapshot: SpiritSnapshot | null, nowMs: number): SpiritSnapshot | null {
    if (!spiritSnapshot) return null;

    const spiritRegenPerSecond = Number(player?.spiritRegenPerSecond || 0);
    const snapshotTsMs = Date.parse(String(spiritSnapshot.ts || ''));
    const spiritMax = getSpiritMaxByBlueStone(player?.stones?.blue);
    if (!Number.isFinite(snapshotTsMs)) {
      return {
        ...spiritSnapshot,
        max: spiritMax,
        current: Math.min(spiritMax, Number(spiritSnapshot.current || 0)),
      };
    }

    if (spiritRegenPerSecond <= 0) {
      return {
        ...spiritSnapshot,
        max: spiritMax,
        current: Math.min(spiritMax, Number(spiritSnapshot.current || 0)),
      };
    }

    // Safety horizon: never extrapolate further than the log delay plus a
    // short lookahead — a stalled log (town, AFK) must not drift to the cap.
    const MAX_SPIRIT_EXTRAPOLATION_MS = 30_000;
    const elapsedMs = Math.min(MAX_SPIRIT_EXTRAPOLATION_MS, Math.max(0, nowMs - snapshotTsMs));
    if (!elapsedMs) {
      return {
        ...spiritSnapshot,
        max: spiritMax,
        current: Math.min(spiritMax, Number(spiritSnapshot.current || 0)),
      };
    }

    const estimatedCurrent = Math.min(
      spiritMax,
      Number(spiritSnapshot.current || 0) + ((elapsedMs / 1000) * spiritRegenPerSecond),
    );

    if (!Number.isFinite(estimatedCurrent) || estimatedCurrent <= Number(spiritSnapshot.current || 0)) {
      return {
        ...spiritSnapshot,
        max: spiritMax,
        current: Math.min(spiritMax, Number(spiritSnapshot.current || 0)),
      };
    }

    return {
      ...spiritSnapshot,
      max: spiritMax,
      current: estimatedCurrent,
    };
  }

  function getSpiritHighlight(player: PlayerState, spiritSnapshot: SpiritSnapshot | null): string {
    // Gunde never logs SP; highlight only when the value comes from the
    // emulation model (tauri). Without the model there is nothing to show.
    if (isGundeClass(player) && !spiritSnapshot?.modeled) return '';

    const currentSpirit = Number(spiritSnapshot?.current || 0);
    const blueStone = Number(player?.stones?.blue || 0);

    if (blueStone >= 1500 && currentSpirit >= 85) return 'spirit-glow-blue';
    if (blueStone >= 450 && blueStone < 2640 && currentSpirit >= 95) return 'spirit-glow-blue';
    if (blueStone < 450 && currentSpirit >= 100) return 'spirit-glow-blue';
    return '';
  }

  function formatSpiritTotal(player: PlayerState, spiritSnapshot: SpiritSnapshot | null, formatNumber: (value: unknown) => string): string {
    if (isGundeClass(player) && !spiritSnapshot?.modeled) {
      const spiritMax = Number(spiritSnapshot?.max || getSpiritMaxByBlueStone(player?.stones?.blue));
      return `- / ${formatNumber(spiritMax)}`;
    }

    return spiritSnapshot ? `${formatNumber(spiritSnapshot.current)} / ${formatNumber(spiritSnapshot.max)}` : '-';
  }

  function getSelectedSkillEntriesForClass(skillCatalog: SkillCatalog, selectedSkillsByClass: SkillSelectionMap, classId: number | null): SkillCatalogAbility[] {
    const orderedTokens = getOrderedTokensForClass(selectedSkillsByClass, classId).filter((token) => token !== RELICS_ORDER_TOKEN);
    if (!orderedTokens.length) return [];
    const normalizedClassId = String(Number(classId || 0));
    const classEntry = (skillCatalog.classes || []).find((entry) => String(entry.id) === normalizedClassId);
    if (!classEntry) return [];
    const abilityMap = new Map((classEntry.abilities || []).map((ability) => [String(ability.id), ability]));
    return orderedTokens.map((token) => abilityMap.get(token)).filter((ability): ability is SkillCatalogAbility => !!ability);
  }

  function getOrderedTokensForClass(selectedSkillsByClass: SkillSelectionMap, classId: number | null): string[] {
    const normalizedClassId = String(Number(classId || 0));
    const raw = Array.isArray(selectedSkillsByClass[normalizedClassId]) ? selectedSkillsByClass[normalizedClassId] : [];
    const seen = new Set<string>();
    const tokens: string[] = [];

    raw.forEach((token) => {
      const normalizedToken = String(token) === RELICS_ORDER_TOKEN ? RELICS_ORDER_TOKEN : String(Number(token));
      if (!normalizedToken || normalizedToken === 'NaN' || seen.has(normalizedToken)) return;
      seen.add(normalizedToken);
      tokens.push(normalizedToken);
    });

    if (!seen.has(RELICS_ORDER_TOKEN)) tokens.push(RELICS_ORDER_TOKEN);
    return tokens;
  }

  function getAbilityActivationTimestampMsList(ability: SerializedAbilityStat | undefined): number[] {
    const rawTimestamps = Array.isArray(ability?.activationTimestamps) && ability.activationTimestamps.length
      ? ability.activationTimestamps
      : (ability?.lastActivationTs ? [ability.lastActivationTs] : []);
    const seen = new Set<number>();
    const result: number[] = [];

    rawTimestamps.forEach((ts) => {
      const tsMs = Date.parse(String(ts || ''));
      if (!Number.isFinite(tsMs) || seen.has(tsMs)) return;
      seen.add(tsMs);
      result.push(tsMs);
    });

    return result.sort((a, b) => a - b);
  }

  function buildCooldownAccelerationWindows(abilityMap: Map<string, SerializedAbilityStat>): CooldownAccelerationWindow[] {
    const windows: CooldownAccelerationWindow[] = [];

    COOLDOWN_ACCELERATION_EFFECTS.forEach((effect) => {
      const ability = abilityMap.get(String(effect.abilityId));
      getAbilityActivationTimestampMsList(ability).forEach((startMs) => {
        windows.push({
          startMs,
          endMs: startMs + effect.durationMs,
          speedBonus: effect.speedBonus,
        });
      });
    });

    return windows
      .filter((window) => Number.isFinite(window.startMs) && Number.isFinite(window.endMs) && window.endMs > window.startMs && window.speedBonus > 0)
      .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  }

  function getCooldownSpeedAt(timeMs: number, windows: CooldownAccelerationWindow[]): number {
    return 1 + windows.reduce((sum, window) => (
      window.startMs <= timeMs && timeMs < window.endMs ? sum + window.speedBonus : sum
    ), 0);
  }

  function getNextCooldownSpeedBoundary(afterMs: number, windows: CooldownAccelerationWindow[]): number | null {
    let nextBoundary: number | null = null;

    windows.forEach((window) => {
      [window.startMs, window.endMs].forEach((boundary) => {
        if (boundary <= afterMs) return;
        if (nextBoundary == null || boundary < nextBoundary) nextBoundary = boundary;
      });
    });

    return nextBoundary;
  }

  function computeCooldownWorkMs(startMs: number, endMs: number, windows: CooldownAccelerationWindow[]): number {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;

    let cursor = startMs;
    let workMs = 0;

    while (cursor < endMs) {
      const nextBoundary = getNextCooldownSpeedBoundary(cursor, windows);
      const segmentEndMs = Math.min(endMs, nextBoundary == null ? endMs : nextBoundary);
      if (segmentEndMs <= cursor) break;
      workMs += (segmentEndMs - cursor) * getCooldownSpeedAt(cursor, windows);
      cursor = segmentEndMs;
    }

    return workMs;
  }

  function predictCooldownEndMs(nowMs: number, remainingWorkMs: number, windows: CooldownAccelerationWindow[]): number {
    if (!Number.isFinite(nowMs) || !Number.isFinite(remainingWorkMs) || remainingWorkMs <= 0) return nowMs;

    let cursor = nowMs;
    let remaining = remainingWorkMs;

    while (remaining > 0) {
      const speed = Math.max(1, getCooldownSpeedAt(cursor, windows));
      const nextBoundary = getNextCooldownSpeedBoundary(cursor, windows);
      if (nextBoundary == null) return cursor + (remaining / speed);

      const segmentDurationMs = Math.max(0, nextBoundary - cursor);
      const segmentWorkMs = segmentDurationMs * speed;
      if (segmentWorkMs >= remaining) return cursor + (remaining / speed);

      remaining -= segmentWorkMs;
      cursor = nextBoundary;
    }

    return cursor;
  }

  function computeAcceleratedCooldownState(
    lastUsedMs: number,
    cooldownMs: number,
    nowMs: number,
    windows: CooldownAccelerationWindow[],
  ): { cooldownRemainingMs: number; cooldownEndsAtMs: number | null } {
    if (!Number.isFinite(lastUsedMs) || !Number.isFinite(cooldownMs) || cooldownMs <= 0) {
      return { cooldownRemainingMs: 0, cooldownEndsAtMs: null };
    }

    const relevantWindows = windows.filter((window) => window.endMs > lastUsedMs);
    const completedWorkMs = computeCooldownWorkMs(lastUsedMs, nowMs, relevantWindows);
    const remainingWorkMs = Math.max(0, cooldownMs - completedWorkMs);
    if (remainingWorkMs <= 0) return { cooldownRemainingMs: 0, cooldownEndsAtMs: nowMs };

    const cooldownEndsAtMs = predictCooldownEndMs(nowMs, remainingWorkMs, relevantWindows);
    return {
      cooldownRemainingMs: Math.max(0, cooldownEndsAtMs - nowMs),
      cooldownEndsAtMs,
    };
  }

  function getSkillCooldownModifier(player: PlayerState): number {
    const greenStone = Number(player?.stones?.green || 0);
    if (greenStone >= 1500) return 0.88;
    if (greenStone >= 600) return 0.96;
    return 1;
  }

  function buildTrackedSkillCooldowns(player: PlayerState, skillCatalog: SkillCatalog, selectedSkillsByClass: SkillSelectionMap, nowMs: number): DisplayIcon[] {
    const selectedSkills = getSelectedSkillEntriesForClass(skillCatalog, selectedSkillsByClass, player.classId);
    if (!selectedSkills.length) return [];

    const abilityList = Array.isArray(player.abilities) ? player.abilities : [];
    const abilityMap = new Map(abilityList.map((ability) => [String(Number(ability.id)), ability]));
    const cooldownAccelerationWindows = buildCooldownAccelerationWindows(abilityMap);
    const now = nowMs;
    const cooldownModifier = getSkillCooldownModifier(player);

    return selectedSkills.map((skill) => {
      const ability = abilityMap.get(String(skill.id));
      const activationTimestamps = Array.isArray(ability?.activationTimestamps) ? ability.activationTimestamps : [];
      const lastActivation = ability?.lastActivationTs || (activationTimestamps.length ? activationTimestamps[activationTimestamps.length - 1] : null);
      const lastUsedMs = lastActivation ? Date.parse(lastActivation) : NaN;
      const adjustedCooldownSeconds = Number(skill.cooldown || 0) * cooldownModifier;
      const adjustedCooldownMs = adjustedCooldownSeconds * 1000;
      const acceleratedState = computeAcceleratedCooldownState(lastUsedMs, adjustedCooldownMs, now, cooldownAccelerationWindows);
      const cooldownRemainingMs = Number.isFinite(lastUsedMs) ? acceleratedState.cooldownRemainingMs : 0;
      const cooldownEndsAt = cooldownRemainingMs > 0 && acceleratedState.cooldownEndsAtMs != null
        ? acceleratedState.cooldownEndsAtMs
        : null;

      return {
        key: `skill-${player.classId}-${skill.id}`,
        id: skill.id,
        name: skill.name,
        icon: skill.icon,
        baseCooldown: adjustedCooldownSeconds,
        originalCooldown: Number(skill.cooldown || 0),
        cooldownModifier,
        effectiveCooldown: adjustedCooldownSeconds,
        cooldownRemainingMs,
        lastUsedAt: lastActivation,
        cooldownEndsAt: cooldownEndsAt ? new Date(cooldownEndsAt).toISOString() : null,
        isReady: cooldownRemainingMs <= 0,
      };
    }).sort((a, b) => {
      if (a.isReady !== b.isReady) return a.isReady ? 1 : -1;
      return a.id - b.id;
    });
  }

  function getRolePriority(player: PlayerState): number {
    const classId = Number(player?.classId || 0);
    if (TANK_CLASS_IDS.has(classId)) return 0;
    if (HEALER_CLASS_IDS.has(classId)) return 2;
    return 1;
  }

  function createPlayerCardRenderer(deps: PlayerCardRendererDeps) {
    const {
      applyCardLayout,
      cardMap,
      formatNumber,
      getCardScale,
      getDefaultPosition,
      getFrameGap,
      getIconsPerRow,
      getLayoutDirection,
      getLatestData,
      getOverlayLocked,
      getPartyFrameFields,
      getPartyFrameColors,
      getPartyFrameAlignment,
      getPartyFrameGrowthDirection,
      getPartySlotIndex,
      getSelectedSkillsByClass,
      getSkillCatalog,
      loadPositions,
      playersContainer,
      renderPullInfo,
      renderRecentSkillsPanel,
      savePositions,
      t,
    } = deps;

    let partyGroupEl: HTMLElement | null = null;
    let lastAppliedPartyGrowthDirection: PartyFrameGrowthDirection | null = null;

    function savePartyGroupCurrentPosition(group: HTMLElement): void {
      const nextPositions = loadPositions();
      nextPositions[PARTY_GROUP_KEY] = {
        x: parseFloat(group.style.left || '0'),
        y: parseFloat(group.style.top || '0'),
      };
      savePositions(nextPositions);
    }

    function preservePartyGroupAnchor(group: HTMLElement, previousRect: DOMRect, growthDirection: PartyFrameGrowthDirection): void {
      if (!previousRect.width && !previousRect.height) return;
      const nextRect = group.getBoundingClientRect();
      const currentLeft = parseFloat(group.style.left || '0');
      const deltaX = growthDirection === 'left'
        ? previousRect.right - nextRect.right
        : previousRect.left - nextRect.left;
      if (!Number.isFinite(deltaX) || Math.abs(deltaX) < 0.5) return;
      group.style.left = `${Math.max(0, currentLeft + deltaX)}px`;
      savePartyGroupCurrentPosition(group);
    }

    function ensurePartyGroup(): HTMLElement {
      if (partyGroupEl?.isConnected) return partyGroupEl;
      const positions = loadPositions();
      const savedPosition = positions[PARTY_GROUP_KEY] || getDefaultPosition(0);
      const group = document.createElement('div');
      group.className = 'party-group layout-vertical';
      group.style.left = `${savedPosition.x}px`;
      group.style.top = `${savedPosition.y}px`;
      playersContainer.appendChild(group);
      partyGroupEl = group;

      let dragging = false;
      let startMouseX = 0;
      let startMouseY = 0;
      let startLeft = 0;
      let startTop = 0;

      const onMove = (event: MouseEvent): void => {
        if (!dragging || !partyGroupEl) return;
        const dx = event.clientX - startMouseX;
        const dy = event.clientY - startMouseY;
        const left = Math.max(0, startLeft + dx);
        const top = Math.max(0, startTop + dy);
        partyGroupEl.style.left = `${left}px`;
        partyGroupEl.style.top = `${top}px`;
      };

      const onUp = (): void => {
        if (!dragging || !partyGroupEl) return;
        dragging = false;
        savePartyGroupCurrentPosition(partyGroupEl);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      group.addEventListener('mousedown', (event: MouseEvent) => {
        if (!getOverlayLocked()) return;
        if (event.target instanceof HTMLElement && event.target.closest('button, input, select, label')) return;
        dragging = true;
        startMouseX = event.clientX;
        startMouseY = event.clientY;
        startLeft = parseFloat(group.style.left || '0');
        startTop = parseFloat(group.style.top || '0');
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        event.preventDefault();
        event.stopPropagation();
      });

      return group;
    }

    function updatePartyGroupLayout(): void {
      const group = ensurePartyGroup();
      const layoutDirection = getLayoutDirection();
      const growthDirection = getPartyFrameGrowthDirection();
      const previousRect = group.getBoundingClientRect();
      const previousGrowthDirection = lastAppliedPartyGrowthDirection;

      group.classList.toggle('layout-horizontal', layoutDirection === 'horizontal');
      group.classList.toggle('layout-vertical', layoutDirection !== 'horizontal');
      group.classList.toggle('party-grow-left', growthDirection === 'left');
      group.classList.toggle('party-grow-right', growthDirection !== 'left');
      group.classList.toggle('drag-enabled', getOverlayLocked());
      group.style.setProperty('--party-gap', `${getFrameGap()}px`);

      if (previousGrowthDirection && previousGrowthDirection !== growthDirection) {
        preservePartyGroupAnchor(group, previousRect, growthDirection);
      }
      lastAppliedPartyGrowthDirection = growthDirection;
    }

    function createCard(player: PlayerState): HTMLElement {
      const card = document.createElement('div');
      card.className = 'panel player-card interactive floating-card';
      card.dataset.playerId = player.id || '';
      card.innerHTML = `
        <div class="player-header">
          <div class="player-title-block">
            <div class="player-name"></div>
            <div class="player-class"></div>
          </div>
        </div>
        <div class="player-info-row">
          <div class="spirit-inline">
            <span class="spirit-label">${escapeHtml(t('spirit'))}</span>
            <span class="spirit-total">-</span>
          </div>
          <div class="shrooms-inline hidden">
            <img
              class="shrooms-icon"
              src="${escapeHtml(toAssetSrc('game-data/heroes/14_Sylvie/1073_shroomsplosion.jpg'))}"
              alt=""
              title="${escapeHtml(t('shrooms'))}"
            />
            <span class="shrooms-fresh">0</span>
            <span class="shrooms-medium">0</span>
            <span class="shrooms-expiring">0</span>
            <span class="shrooms-upcoming">(0)</span>
          </div>
          <div class="relics-block"></div>
        </div>
      `;
      ensurePartyGroup().appendChild(card);
      cardMap.set(player.id, card);
      return card;
    }

    function updateCard(card: HTMLElement, player: PlayerState): void {
      const history = Array.isArray(player.spiritHistory) ? player.spiritHistory : [];
      const last = player.spirit || history[history.length - 1] || null;
      const classColor = player.classColor || '#6b7280';
      const partyFrameFields = getPartyFrameFields();
      const partyFrameColors = getPartyFrameColors();
      const partyFrameAlignment = getPartyFrameAlignment();
      const effectiveNowMs = getEffectiveNowMs(getLatestData());
      const displaySpirit = buildDisplayedSpiritSnapshot(player, last, effectiveNowMs);
      const trackedSkills = buildTrackedSkillCooldowns(player, getSkillCatalog(), getSelectedSkillsByClass(), effectiveNowMs);
      const trackedSkillMap = new Map(trackedSkills.map((skill) => [String(skill.id), skill]));
      const relicIcons = (player.relics || []).map((relic) => ({ ...relic, key: `relic-${relic.id}` }));
      const displayIcons: DisplayIcon[] = [];
      let relicsInserted = false;

      getOrderedTokensForClass(getSelectedSkillsByClass(), player.classId).forEach((token) => {
        if (token === RELICS_ORDER_TOKEN) {
          displayIcons.push(...relicIcons);
          relicsInserted = true;
          return;
        }
        const trackedSkill = trackedSkillMap.get(token);
        if (trackedSkill) displayIcons.push(trackedSkill);
      });

      if (!relicsInserted) displayIcons.push(...relicIcons);
      const visibleIconCount = partyFrameFields.relicsAndCooldowns ? displayIcons.length : 0;
      applyCardLayout(card, getCardScale(), visibleIconCount, getIconsPerRow());

      const playerHeader = card.querySelector<HTMLElement>('.player-header');
      const playerInfoRow = card.querySelector<HTMLElement>('.player-info-row');
      const playerName = card.querySelector<HTMLElement>('.player-name');
      const playerClass = card.querySelector<HTMLElement>('.player-class');
      const spiritInline = card.querySelector<HTMLElement>('.spirit-inline');
      const spiritEl = card.querySelector<HTMLElement>('.spirit-total');
      const shroomsInline = card.querySelector<HTMLElement>('.shrooms-inline');
      const shroomsFresh = card.querySelector<HTMLElement>('.shrooms-fresh');
      const shroomsMedium = card.querySelector<HTMLElement>('.shrooms-medium');
      const shroomsExpiring = card.querySelector<HTMLElement>('.shrooms-expiring');
      const shroomsUpcoming = card.querySelector<HTMLElement>('.shrooms-upcoming');
      const relicsBlock = card.querySelector<HTMLElement>('.relics-block');
      if (!playerHeader || !playerInfoRow || !playerName || !playerClass || !spiritInline || !spiritEl
        || !shroomsInline || !shroomsFresh || !shroomsMedium || !shroomsExpiring || !shroomsUpcoming || !relicsBlock) return;

      card.classList.remove('party-align-left', 'party-align-center', 'party-align-right');
      card.classList.add(`party-align-${partyFrameAlignment}`);

      playerName.textContent = player.name || t('unknown');
      playerName.style.color = partyFrameColors.playerName;
      playerClass.textContent = player.className || t('unknown');
      playerClass.style.color = partyFrameColors.championNameUseClassColor ? classColor : partyFrameColors.championName;
      playerName.classList.toggle('hidden', !partyFrameFields.playerName);
      playerClass.classList.toggle('hidden', !partyFrameFields.championName);
      playerHeader.classList.toggle('hidden', !partyFrameFields.playerName && !partyFrameFields.championName);
      card.style.setProperty('--party-spirit-color', partyFrameColors.spirit);
      card.style.setProperty('--party-relic-timer-color', partyFrameColors.relicTimer);
      spiritEl.textContent = formatSpiritTotal(player, displaySpirit, formatNumber);
      spiritEl.classList.remove('spirit-glow-blue');
      const spiritHighlightClass = getSpiritHighlight(player, displaySpirit);
      if (spiritHighlightClass) spiritEl.classList.add(spiritHighlightClass);
      spiritInline.classList.toggle('hidden', !partyFrameFields.spirit);
      const showShrooms = isSylvieClass(player);
      const shrooms = getDisplayedShrooms(player, effectiveNowMs);
      shroomsFresh.textContent = formatNumber(shrooms.fresh);
      shroomsMedium.textContent = formatNumber(shrooms.medium);
      shroomsExpiring.textContent = formatNumber(shrooms.expiring);
      shroomsUpcoming.textContent = `(${formatNumber(shrooms.upcoming)})`;
      shroomsInline.classList.toggle('hidden', !showShrooms);
      const { iconSize, iconGap } = getScaledMetrics(getCardScale());
      const columnCount = Math.max(1, Math.min(getIconsPerRow(), visibleIconCount || 0));
      const rowCount = Math.max(1, Math.ceil((visibleIconCount || 0) / columnCount));
      relicsBlock.style.setProperty('--tracked-columns', String(columnCount));
      relicsBlock.style.setProperty('--tracked-rows', String(rowCount));
      relicsBlock.style.width = `${(columnCount * iconSize) + (Math.max(0, columnCount - 1) * iconGap)}px`;
      relicsBlock.style.maxWidth = '100%';
      relicsBlock.style.margin = partyFrameAlignment === 'right'
        ? '0 0 0 auto'
        : partyFrameAlignment === 'center'
          ? '0 auto'
          : '0';
      relicsBlock.classList.toggle('hidden', !partyFrameFields.relicsAndCooldowns);
      playerInfoRow.classList.toggle('hidden', !partyFrameFields.spirit && !partyFrameFields.relicsAndCooldowns && !showShrooms);
      updateIconNodes(relicsBlock, partyFrameFields.relicsAndCooldowns ? displayIcons : []);
    }

    function renderPlayers(players: PlayerState[] = []): void {
      const group = ensurePartyGroup();
      updatePartyGroupLayout();
      const orderedPlayers = [...players]
        .map((player, index) => ({ player, index }))
        .sort((a, b) => {
          const roleDiff = getRolePriority(a.player) - getRolePriority(b.player);
          if (roleDiff !== 0) return roleDiff;
          return getPartySlotIndex(a.player, a.index) - getPartySlotIndex(b.player, b.index);
        })
        .map(({ player }) => player);
      const activeIds = new Set(orderedPlayers.map((player) => player.id));

      for (const [playerId, card] of cardMap.entries()) {
        if (!activeIds.has(playerId)) {
          card.remove();
          cardMap.delete(playerId);
        }
      }

      const latestData = getLatestData();
      renderPullInfo(latestData?.currentPull, latestData?.dungeon);
      renderRecentSkillsPanel(latestData?.recentSkills || []);

      orderedPlayers.forEach((player) => {
        let card = cardMap.get(player.id);
        if (!card) {
          card = createCard(player);
        }
        updateCard(card, player);
        group.appendChild(card);
      });
    }

    function tickCooldowns(): void {
      const latestData = getLatestData();
      if (!latestData?.players?.length) {
        renderPullInfo(latestData?.currentPull, latestData?.dungeon);
        renderRecentSkillsPanel(latestData?.recentSkills || []);
        return;
      }
      const now = getEffectiveNowMs(latestData);
      latestData.players.forEach((player) => {
        const card = cardMap.get(player.id);
        if (!card) return;
        (player.relics || []).forEach((relic) => {
          if (!relic.cooldownEndsAt) return;
          const endMs = Date.parse(relic.cooldownEndsAt);
          relic.cooldownRemainingMs = Number.isFinite(endMs) ? Math.max(0, endMs - now) : 0;
          relic.isReady = relic.cooldownRemainingMs <= 0;
        });
        updateCard(card, player);
      });
    }

    return {
      renderPlayers,
      tickCooldowns,
    };
  }

  window.OverlayRendererPlayerCards = {
    createPlayerCardRenderer,
  };
})();
