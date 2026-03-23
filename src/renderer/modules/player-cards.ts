(() => {
  const { escapeHtml, formatDurationMs, toAssetSrc } = window.OverlayRendererFormatters;

  type DisplayIcon = PlayerRelicState & {
    key: string;
    originalCooldown?: number;
  };

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


  function getEffectiveNowMs(latestData: FinalizedState | null): number {
    const correctedClientNowMs = Date.now() + Number(latestData?.timeCorrectionMs || 0);
    const latestLogTsMs = Date.parse(String(latestData?.latestLogTs || ''));
    return Math.max(correctedClientNowMs, Number.isFinite(latestLogTsMs) ? latestLogTsMs : 0);
  }

  function getSpiritMaxByBlueStone(blueStone: unknown): number {
    const blue = Number(blueStone || 0);
    if (blue >= 1200) return 135;
    if (blue > 120) return 110;
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

    const elapsedMs = Math.max(0, nowMs - snapshotTsMs);
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

  function buildTrackedSkillCooldowns(player: PlayerState, skillCatalog: SkillCatalog, selectedSkillsByClass: SkillSelectionMap, nowMs: number): DisplayIcon[] {
    const selectedSkills = getSelectedSkillEntriesForClass(skillCatalog, selectedSkillsByClass, player.classId);
    if (!selectedSkills.length) return [];

    const abilityList = Array.isArray(player.abilities) ? player.abilities : [];
    const abilityMap = new Map(abilityList.map((ability) => [String(Number(ability.id)), ability]));
    const now = nowMs;
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
        cooldownModifier: cooldownModifier,
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

  function createPlayerCardRenderer(deps: PlayerCardRendererDeps) {
    const {
      applyCardLayout,
      cardMap,
      formatNumber,
      getCardScale,
      getDefaultPosition,
      getLatestData,
      getOverlayLocked,
      getPartySlotIndex,
      getPlayerLayoutKey,
      getSelectedSkillsByClass,
      getSkillCatalog,
      loadPositions,
      makeCardDraggable,
      playersContainer,
      renderPullInfo,
      renderRecentSkillsPanel,
      savePositions,
      t,
    } = deps;

    function createCard(player: PlayerState, slotIndex: number, positions: Record<string, { x: number; y: number }>): HTMLElement {
      const layoutKey = getPlayerLayoutKey(slotIndex);
      const pos = positions[layoutKey] || getDefaultPosition(slotIndex);
      const card = document.createElement('div');
      card.className = 'panel player-card interactive floating-card';
      card.dataset.playerId = player.id || '';
      card.dataset.layoutKey = layoutKey;
      card.style.left = `${pos.x}px`;
      card.style.top = `${pos.y}px`;
      card.innerHTML = `
        <div class="player-header drag-handle">
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
      applyCardLayout(card, getCardScale(), 0);
      makeCardDraggable({
        card,
        dragHandle: card.querySelector<HTMLElement>('.drag-handle') as HTMLElement,
        getOverlayLocked,
        getPlayerLayoutKey,
        layoutKey,
        positions,
        savePositions,
      });
      playersContainer.appendChild(card);
      cardMap.set(player.id, card);
      return card;
    }

    function updateCard(card: HTMLElement, player: PlayerState): void {
      const history = Array.isArray(player.spiritHistory) ? player.spiritHistory : [];
      const last = player.spirit || history[history.length - 1] || null;
      const classColor = player.classColor || '#6b7280';
      const effectiveNowMs = getEffectiveNowMs(getLatestData());
      const displaySpirit = buildDisplayedSpiritSnapshot(player, last, effectiveNowMs);
      const trackedSkills = buildTrackedSkillCooldowns(player, getSkillCatalog(), getSelectedSkillsByClass(), effectiveNowMs);
      const displayIcons: DisplayIcon[] = [...trackedSkills, ...(player.relics || []).map((relic) => ({ ...relic, key: `relic-${relic.id}` }))];
      applyCardLayout(card, getCardScale(), displayIcons.length);

      card.dataset.playerId = player.id || '';
      const playerName = card.querySelector<HTMLElement>('.player-name');
      const playerClass = card.querySelector<HTMLElement>('.player-class');
      const spiritEl = card.querySelector<HTMLElement>('.spirit-total');
      const relicsBlock = card.querySelector<HTMLElement>('.relics-block');
      if (!playerName || !playerClass || !spiritEl || !relicsBlock) return;

      playerName.textContent = player.name || t('unknown');
      playerClass.textContent = player.className || t('unknown');
      playerClass.style.color = classColor;
      spiritEl.textContent = displaySpirit ? `${formatNumber(displaySpirit.current)} / ${formatNumber(displaySpirit.max)}` : '-';
      spiritEl.classList.remove('spirit-glow-blue');
      const spiritHighlightClass = getSpiritHighlight(player, displaySpirit);
      if (spiritHighlightClass) spiritEl.classList.add(spiritHighlightClass);
      updateIconNodes(relicsBlock, displayIcons);
    }

    function renderPlayers(players: PlayerState[] = []): void {
      const positions = loadPositions();
      const activeIds = new Set(players.map((player) => player.id));

      for (const [playerId, card] of cardMap.entries()) {
        if (!activeIds.has(playerId)) {
          card.remove();
          cardMap.delete(playerId);
        }
      }

      const latestData = getLatestData();
      renderPullInfo(latestData?.currentPull, latestData?.dungeon);
      renderRecentSkillsPanel(latestData?.recentSkills || []);

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
