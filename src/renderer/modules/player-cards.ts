(() => {
  const { escapeHtml, formatDurationMs, toAssetSrc } = window.OverlayRendererFormatters;
  const { getScaledMetrics } = window.OverlayRendererLayout;

  type DisplayIcon = PlayerRelicState & {
    key: string;
    originalCooldown?: number;
  };

  const PARTY_GROUP_KEY = 'party-group';
  const TANK_CLASS_IDS = new Set([22, 13, 25]);
  const HEALER_CLASS_IDS = new Set([24, 14, 20]);

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

      icon.src = toAssetSrc(item.icon || 'game-data/relics/empty.png');
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

  function getSpiritHighlight(player: PlayerState, spiritSnapshot: SpiritSnapshot | null): string {
    const currentSpirit = Number(spiritSnapshot?.current || 0);
    const blueStone = Number(player?.stones?.blue || 0);

    if (blueStone >= 2640 && currentSpirit >= 85) return 'spirit-glow-blue';
    if (blueStone >= 960 && blueStone < 2640 && currentSpirit >= 95) return 'spirit-glow-blue';
    if (blueStone < 960 && currentSpirit >= 100) return 'spirit-glow-blue';
    return '';
  }

  function getSelectedSkillEntriesForClass(skillCatalog: SkillCatalog, selectedSkillsByClass: SkillSelectionMap, classId: number | null): SkillCatalogAbility[] {
    const normalizedClassId = String(Number(classId || 0));
    const selectedAbilityIds = selectedSkillsByClass[normalizedClassId] || [];
    if (!selectedAbilityIds.length) return [];
    const classEntry = (skillCatalog.classes || []).find((entry) => String(entry.id) === normalizedClassId);
    if (!classEntry) return [];
    const wanted = new Set(selectedAbilityIds.map((id) => String(Number(id))));
    return (classEntry.abilities || []).filter((ability) => wanted.has(String(ability.id)));
  }

  function getSkillCooldownModifier(player: PlayerState): number {
    const greenStone = Number(player?.stones?.green || 0);
    if (greenStone >= 2640) return 0.88;
    if (greenStone >= 960) return 0.96;
    return 1;
  }

  function buildTrackedSkillCooldowns(player: PlayerState, skillCatalog: SkillCatalog, selectedSkillsByClass: SkillSelectionMap): DisplayIcon[] {
    const selectedSkills = getSelectedSkillEntriesForClass(skillCatalog, selectedSkillsByClass, player.classId);
    if (!selectedSkills.length) return [];

    const abilityList = Array.isArray(player.abilities) ? player.abilities : [];
    const abilityMap = new Map(abilityList.map((ability) => [String(Number(ability.id)), ability]));
    const now = Date.now();
    const cooldownModifier = getSkillCooldownModifier(player);

    return selectedSkills.map((skill) => {
      const ability = abilityMap.get(String(skill.id));
      const activationTimestamps = Array.isArray(ability?.activationTimestamps) ? ability.activationTimestamps : [];
      const lastActivation = ability?.lastActivationTs || (activationTimestamps.length ? activationTimestamps[activationTimestamps.length - 1] : null);
      const lastUsedMs = lastActivation ? Date.parse(lastActivation) : NaN;
      const adjustedCooldownSeconds = Number(skill.cooldown || 0) * cooldownModifier;
      const cooldownEndsAt = Number.isFinite(lastUsedMs) ? lastUsedMs + adjustedCooldownSeconds * 1000 : null;
      const cooldownRemainingMs = cooldownEndsAt ? Math.max(0, cooldownEndsAt - now) : 0;

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
        const nextPositions = loadPositions();
        nextPositions[PARTY_GROUP_KEY] = {
          x: parseFloat(partyGroupEl.style.left || '0'),
          y: parseFloat(partyGroupEl.style.top || '0'),
        };
        savePositions(nextPositions);
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
      group.classList.toggle('layout-horizontal', layoutDirection === 'horizontal');
      group.classList.toggle('layout-vertical', layoutDirection !== 'horizontal');
      group.classList.toggle('drag-enabled', getOverlayLocked());
      group.style.setProperty('--party-gap', `${getFrameGap()}px`);
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
      const trackedSkills = buildTrackedSkillCooldowns(player, getSkillCatalog(), getSelectedSkillsByClass());
      const displayIcons: DisplayIcon[] = [...trackedSkills, ...(player.relics || []).map((relic) => ({ ...relic, key: `relic-${relic.id}` }))];
      applyCardLayout(card, getCardScale(), displayIcons.length, getIconsPerRow());

      const playerName = card.querySelector<HTMLElement>('.player-name');
      const playerClass = card.querySelector<HTMLElement>('.player-class');
      const spiritEl = card.querySelector<HTMLElement>('.spirit-total');
      const relicsBlock = card.querySelector<HTMLElement>('.relics-block');
      if (!playerName || !playerClass || !spiritEl || !relicsBlock) return;

      playerName.textContent = player.name || t('unknown');
      playerClass.textContent = player.className || t('unknown');
      playerClass.style.color = classColor;
      spiritEl.textContent = last ? `${formatNumber(last.current)} / ${formatNumber(last.max)}` : '-';
      spiritEl.classList.remove('spirit-glow-blue');
      const spiritHighlightClass = getSpiritHighlight(player, last);
      if (spiritHighlightClass) spiritEl.classList.add(spiritHighlightClass);
      const { iconSize, iconGap } = getScaledMetrics(getCardScale());
      const rowCount = Math.max(1, Math.min(getIconsPerRow(), displayIcons.length || 0));
      relicsBlock.style.width = `${(rowCount * iconSize) + (Math.max(0, rowCount - 1) * iconGap)}px`;
      relicsBlock.style.maxWidth = '100%';
      relicsBlock.style.margin = '0 auto';
      updateIconNodes(relicsBlock, displayIcons);
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
      const now = Date.now();
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
