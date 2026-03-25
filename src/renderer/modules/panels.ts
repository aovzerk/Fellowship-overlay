(() => {
  const { clamp, escapeHtml, formatPercent, toAssetSrc } = window.OverlayRendererFormatters;

  function getDefaultSkillIcon(): string {
    return 'game-data/heroes/Default/default_skill.jpg';
  }

  function getAbilityCatalogEntry(skillCatalog: SkillCatalog, classId: number | null, abilityId: number | null): SkillCatalogAbility | null {
    const normalizedClassId = String(Number(classId || 0));
    const wantedAbilityId = String(Number(abilityId || 0));
    const classEntry = (skillCatalog.classes || []).find((entry) => String(Number(entry.id || 0)) === normalizedClassId);
    if (!classEntry) return null;
    return (classEntry.abilities || []).find((ability) => String(Number(ability.id || 0)) === wantedAbilityId) || null;
  }

  function resolveRecentSkillIcon(skillCatalog: SkillCatalog, entry: RecentSkillActivation | null | undefined): string {
    if (entry?.icon) return entry.icon;
    const catalogEntry = getAbilityCatalogEntry(skillCatalog, entry?.classId ?? null, entry?.abilityId ?? null);
    return catalogEntry?.icon || getDefaultSkillIcon();
  }

  function updatePullPanelVisibility({ filePathEl, latestData, pullInfoEl, translate, visibilitySettings }: PullPanelVisibilityArgs): void {
    const hasSelectedFile = !!(latestData || (filePathEl.textContent && filePathEl.textContent !== translate('noFileSelected')));
    const isVisible = hasSelectedFile && visibilitySettings.showPull;
    pullInfoEl.classList.toggle('hidden', !isVisible);
  }

  function updateRecentSkillsPanelVisibility({ filePathEl, latestData, recentSkillsPanelEl, translate, visibilitySettings }: RecentSkillsPanelVisibilityArgs): void {
    const hasSelectedFile = !!(latestData || (filePathEl.textContent && filePathEl.textContent !== translate('noFileSelected')));
    const isVisible = hasSelectedFile && visibilitySettings.showRecentSkills;
    recentSkillsPanelEl.classList.toggle('hidden', !isVisible);
  }

  function renderRecentSkillsPanel({
    currentLanguage,
    getCardWidthForIconCount,
    recentSkillsGrowthDirection,
    recentSkillsLayoutDirection,
    recentSkillsTrackCount,
    recentSkills,
    recentSkillsLimit,
    recentSkillsPanelEl,
    skillCatalog,
    translate,
    updateRecentSkillsPanelVisibility,
  }: RenderRecentSkillsPanelArgs): void {
    const allItems = Array.isArray(recentSkills) ? recentSkills : [];
    const normalizedLimit = clamp(Number(recentSkillsLimit || 7), 1, 20);
    const items = allItems.slice(-normalizedLimit).map((entry) => ({
      ...entry,
      icon: resolveRecentSkillIcon(skillCatalog, entry),
    }));

    if (!items.length) {
      recentSkillsPanelEl.innerHTML = `
        <div class="player-header drag-handle recent-skills-header">
          <div class="player-title-block">
            <div class="player-name">${escapeHtml(translate('recentSkillsTitle'))}</div>
          </div>
        </div>
        <div class="pull-empty">${escapeHtml(translate('noRecentSkills'))}</div>
      `;
      recentSkillsPanelEl.style.width = '';
      updateRecentSkillsPanelVisibility();
      return;
    }

    recentSkillsPanelEl.innerHTML = `
      <div class="player-header drag-handle recent-skills-header">
        <div class="player-title-block">
          <div class="player-name">${escapeHtml(translate('recentSkillsTitle'))}</div>
        </div>
      </div>
      <div class="recent-skills-row"></div>
    `;

    const row = recentSkillsPanelEl.querySelector<HTMLElement>('.recent-skills-row');
    if (!row) return;

    const trackCount = clamp(Number(recentSkillsTrackCount || 3), 1, 6);
    const isHorizontal = recentSkillsLayoutDirection === 'horizontal';
    const primaryCount = Math.max(1, Math.min(trackCount, items.length));
    const rowCount = isHorizontal
      ? primaryCount
      : Math.max(1, Math.ceil(items.length / primaryCount));
    const columnCount = isHorizontal
      ? Math.max(1, Math.ceil(items.length / rowCount))
      : primaryCount;

    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      const chip = document.createElement('div');
      chip.className = 'relic-chip recent-skill-chip';
      chip.dataset.key = `${item.playerId || 'player'}-${item.abilityId || 'skill'}-${item.ts || index}`;
      chip.innerHTML = '<img class="relic-icon" alt="" />';
      const icon = chip.querySelector<HTMLImageElement>('.relic-icon');
      if (!icon) return;
      icon.src = toAssetSrc(item.icon || getDefaultSkillIcon());
      icon.alt = escapeHtml(item.abilityName || 'Skill');
      fragment.appendChild(chip);
    });

    row.appendChild(fragment);
    row.dataset.layout = recentSkillsLayoutDirection;
    row.dataset.growth = recentSkillsGrowthDirection;
    row.style.setProperty('--recent-skills-columns', String(columnCount));
    row.style.setProperty('--recent-skills-rows', String(rowCount));
    recentSkillsPanelEl.style.width = `${getCardWidthForIconCount(columnCount, columnCount)}px`;
    updateRecentSkillsPanelVisibility();
  }

  function renderPullInfo({
    currentLanguage,
    currentPull,
    dungeon,
    pullInfoEl,
    renderRecentSkillsPanelEmpty,
    translate,
    updatePullPanelVisibility,
    updateRecentSkillsPanelVisibility,
  }: RenderPullInfoArgs): void {
    const mobs = Array.isArray(currentPull?.mobs) ? currentPull.mobs : [];
    const alivePercent = Number(currentPull?.alivePercent || 0);
    const completedPercent = Number(dungeon?.completedPercent || 0);
    const dungeonEnded = Boolean(dungeon?.endedAt);
    const projectedTotalPercent = dungeonEnded ? completedPercent : (completedPercent + alivePercent);
    const chickenizedCount = Number(currentPull?.chickenizedCount || 0);
    const chickenizedOriginalPercent = Number(currentPull?.chickenizedOriginalPercent || 0);
    const aliveChickenizedCount = Number(currentPull?.aliveChickenizedCount || 0);
    const aliveChickenizedOriginalPercent = Number(currentPull?.aliveChickenizedOriginalPercent || 0);
    const dungeonTitle = String(dungeon?.name || '').trim() || translate('currentPull');

    if (!mobs.length) {
      pullInfoEl.innerHTML = `
        <div class="pull-title pull-drag-handle">${escapeHtml(dungeonTitle)}</div>
        <div class="pull-empty">${escapeHtml(translate('noPullData'))}</div>
      `;
      renderRecentSkillsPanelEmpty();
      updatePullPanelVisibility();
      updateRecentSkillsPanelVisibility();
      return;
    }

    const chickenizedLine = chickenizedCount > 0
      ? `<div class="pull-note chickenized">${escapeHtml(translate('chickenizedInfo'))}: <strong>${escapeHtml(String(chickenizedCount))}</strong> ${escapeHtml(translate('chickenizedSuffix'))} <span>(-${escapeHtml(formatPercent(currentLanguage, chickenizedOriginalPercent))}%${aliveChickenizedCount > 0 ? `, ${escapeHtml(translate('chickenizedAlive'))}: ${escapeHtml(String(aliveChickenizedCount))} / -${escapeHtml(formatPercent(currentLanguage, aliveChickenizedOriginalPercent))}%` : ''})</span></div>`
      : '';

    const completedLine = `<div class="pull-stat"><span>${escapeHtml(translate('pullCompleted'))}</span><strong>${escapeHtml(formatPercent(currentLanguage, completedPercent))}%</strong></div>`;
    const aliveLine = dungeonEnded
      ? ''
      : `<div class="pull-stat"><span>${escapeHtml(translate('pullAlive'))}</span><strong>${escapeHtml(formatPercent(currentLanguage, alivePercent))}%</strong></div>`;
    const totalLine = `<div class="pull-stat"><span>${escapeHtml(dungeonEnded ? translate('pullTotal') : translate('pullProjected'))}</span><strong>${escapeHtml(formatPercent(currentLanguage, projectedTotalPercent))}%</strong></div>`;

    pullInfoEl.innerHTML = `
      <div class="pull-title pull-drag-handle">${escapeHtml(dungeonTitle)}</div>
      <div class="pull-stats">
        ${completedLine}
        ${aliveLine}
        ${totalLine}
      </div>
      ${chickenizedLine}
    `;
    updatePullPanelVisibility();
  }

  window.OverlayRendererPanels = {
    getAbilityCatalogEntry,
    renderPullInfo,
    renderRecentSkillsPanel,
    resolveRecentSkillIcon,
    updatePullPanelVisibility,
    updateRecentSkillsPanelVisibility,
  };
})();
