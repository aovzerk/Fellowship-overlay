(() => {
  const { escapeHtml, toAssetSrc } = window.OverlayRendererFormatters;
  const RELICS_ORDER_TOKEN = '__relics__';

  function getOrderedTokens(selectedSkillsByClass: SkillSelectionMap, classId: number): string[] {
    const normalizedClassId = String(Number(classId || 0));
    const raw = Array.isArray(selectedSkillsByClass[normalizedClassId]) ? selectedSkillsByClass[normalizedClassId] : [];
    const tokens: string[] = [];
    const seen = new Set<string>();

    raw.forEach((token) => {
      const normalized = String(token) === RELICS_ORDER_TOKEN ? RELICS_ORDER_TOKEN : String(Number(token));
      if (!normalized || normalized === 'NaN' || seen.has(normalized)) return;
      seen.add(normalized);
      tokens.push(normalized);
    });

    if (!seen.has(RELICS_ORDER_TOKEN)) tokens.push(RELICS_ORDER_TOKEN);
    return tokens;
  }

  function saveOrderedTokens(selectedSkillsByClass: SkillSelectionMap, classId: number, tokens: string[]): void {
    const normalizedClassId = String(Number(classId || 0));
    const normalized: string[] = [];
    const seen = new Set<string>();

    (Array.isArray(tokens) ? tokens : []).forEach((token) => {
      const nextToken = String(token) === RELICS_ORDER_TOKEN ? RELICS_ORDER_TOKEN : String(Number(token));
      if (!nextToken || nextToken === 'NaN' || seen.has(nextToken)) return;
      seen.add(nextToken);
      normalized.push(nextToken);
    });

    if (!seen.has(RELICS_ORDER_TOKEN)) normalized.push(RELICS_ORDER_TOKEN);
    selectedSkillsByClass[normalizedClassId] = normalized;
  }

  function buildAbilityOption(classId: number, ability: SkillCatalogAbility, selected: boolean): string {
    const checked = selected ? 'checked' : '';
    return `
      <label class="skill-option">
        <input type="checkbox" data-class-id="${classId}" data-ability-id="${ability.id}" ${checked} />
        <img class="skill-option-icon" src="${toAssetSrc(ability.icon || 'game-data/relics/empty.png')}" alt="${escapeHtml(ability.name)}" />
        <span class="skill-option-text">
          <span class="skill-option-name">${escapeHtml(ability.name)}</span>
          <span class="skill-option-cooldown">${escapeHtml(ability.cooldown)}s</span>
        </span>
      </label>
    `;
  }

  function buildDraggableOrderItem(token: string, classId: number, abilitiesById: Map<string, SkillCatalogAbility>, t: (key: string) => string): string {
    const isRelics = token === RELICS_ORDER_TOKEN;
    const ability = isRelics ? null : abilitiesById.get(String(token));
    const name = isRelics ? t('relics') : (ability?.name || t('unknown'));
    const icon = isRelics ? 'game-data/relics/empty.png' : (ability?.icon || 'game-data/relics/empty.png');

    return `
      <div class="order-item" draggable="true" data-order-class-id="${classId}" data-order-token="${escapeHtml(token)}">
        <img class="skill-option-icon" src="${toAssetSrc(icon)}" alt="${escapeHtml(name)}" />
        <span class="order-item-name">${escapeHtml(name)}</span>
        <span class="order-drag-hint">::</span>
      </div>
    `;
  }

  function renderSkillsModal(args: RenderSkillsModalArgs): void {
    const { latestData, renderPlayers, saveSkillSelections, selectedSkillsByClass, skillCatalog, skillsCatalogEl, t } = args;
    const classes = skillCatalog.classes || [];
    if (!classes.length) {
      skillsCatalogEl.innerHTML = `<div class="empty-state">${escapeHtml(t('skillsEmpty'))}</div>`;
      return;
    }

    skillsCatalogEl.innerHTML = classes.map((heroClass) => {
      const orderedTokens = getOrderedTokens(selectedSkillsByClass, heroClass.id);
      const selected = new Set(orderedTokens.filter((token) => token !== RELICS_ORDER_TOKEN));
      const abilitiesById = new Map((heroClass.abilities || []).map((ability) => [String(ability.id), ability]));
      const orderedItems = orderedTokens.map((token) => buildDraggableOrderItem(token, heroClass.id, abilitiesById, t)).join('');
      const options = (heroClass.abilities || []).map((ability) => buildAbilityOption(heroClass.id, ability, selected.has(String(ability.id)))).join('');
      return `
        <section class="skill-class-group">
          <div class="skill-class-title">${escapeHtml(heroClass.name)}</div>
          <div class="skill-order-title">${escapeHtml(t('selectedOrder'))}</div>
          <div class="skill-order-list">${orderedItems}</div>
          <div class="skill-options-grid">${options}</div>
        </section>
      `;
    }).join('');

    skillsCatalogEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', (event: Event) => {
        const input = event.currentTarget as HTMLInputElement;
        const classId = Number(input.dataset.classId || 0);
        const abilityId = String(Number(input.dataset.abilityId || 0));
        const current = getOrderedTokens(selectedSkillsByClass, classId).filter((token) => token !== RELICS_ORDER_TOKEN);
        const next = input.checked ? [...current, abilityId] : current.filter((token) => token !== abilityId);
        saveOrderedTokens(selectedSkillsByClass, classId, [...next, RELICS_ORDER_TOKEN]);
        saveSkillSelections();
        renderSkillsModal(args);
        if (latestData()?.players) renderPlayers(latestData()?.players || []);
      });
    });

    let draggedClassId = '';
    let draggedToken = '';
    skillsCatalogEl.querySelectorAll<HTMLElement>('.order-item').forEach((item) => {
      item.addEventListener('dragstart', (event: DragEvent) => {
        draggedClassId = String(item.dataset.orderClassId || '');
        draggedToken = String(item.dataset.orderToken || '');
        item.classList.add('is-dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', draggedToken);
        }
      });

      item.addEventListener('dragend', () => {
        draggedClassId = '';
        draggedToken = '';
        skillsCatalogEl.querySelectorAll<HTMLElement>('.order-item').forEach((node) => node.classList.remove('is-dragging', 'drag-over'));
      });

      item.addEventListener('dragover', (event: DragEvent) => {
        const targetClassId = String(item.dataset.orderClassId || '');
        const targetToken = String(item.dataset.orderToken || '');
        if (!draggedToken || !draggedClassId || draggedClassId !== targetClassId || draggedToken === targetToken) return;
        event.preventDefault();
        item.classList.add('drag-over');
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', (event: DragEvent) => {
        const targetClassId = String(item.dataset.orderClassId || '');
        const targetToken = String(item.dataset.orderToken || '');
        item.classList.remove('drag-over');
        if (!draggedToken || !draggedClassId || draggedClassId !== targetClassId || draggedToken === targetToken) return;
        event.preventDefault();
        const orderedTokens = getOrderedTokens(selectedSkillsByClass, Number(targetClassId));
        const sourceIndex = orderedTokens.indexOf(draggedToken);
        const targetIndex = orderedTokens.indexOf(targetToken);
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
        const next = [...orderedTokens];
        const [movedToken] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, movedToken);
        saveOrderedTokens(selectedSkillsByClass, Number(targetClassId), next);
        saveSkillSelections();
        renderSkillsModal(args);
        if (latestData()?.players) renderPlayers(latestData()?.players || []);
      });
    });
  }

  window.OverlayRendererSkillsModal = {
    renderSkillsModal,
  };
})();
