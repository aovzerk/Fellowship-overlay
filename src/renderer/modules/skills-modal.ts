(() => {
  const { escapeHtml, toAssetSrc } = window.OverlayRendererFormatters;

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

  function renderSkillsModal({ latestData, renderPlayers, saveSkillSelections, selectedSkillsByClass, skillCatalog, skillsCatalogEl, t }: RenderSkillsModalArgs): void {
    const classes = skillCatalog.classes || [];
    if (!classes.length) {
      skillsCatalogEl.innerHTML = `<div class="empty-state">${escapeHtml(t('skillsEmpty'))}</div>`;
      return;
    }

    skillsCatalogEl.innerHTML = classes.map((heroClass) => {
      const selected = new Set((selectedSkillsByClass[String(heroClass.id)] || []).map((id) => String(Number(id))));
      const options = (heroClass.abilities || []).map((ability) => buildAbilityOption(heroClass.id, ability, selected.has(String(ability.id)))).join('');
      return `
        <section class="skill-class-group">
          <div class="skill-class-title">${escapeHtml(heroClass.name)}</div>
          <div class="skill-options-grid">${options}</div>
        </section>
      `;
    }).join('');

    skillsCatalogEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', (event: Event) => {
        const input = event.currentTarget as HTMLInputElement;
        const classId = String(Number(input.dataset.classId || 0));
        const abilityId = String(Number(input.dataset.abilityId || 0));
        const current = new Set(selectedSkillsByClass[classId] || []);
        if (input.checked) current.add(abilityId);
        else current.delete(abilityId);
        selectedSkillsByClass[classId] = [...current];
        saveSkillSelections();
        if (latestData()?.players) renderPlayers(latestData()?.players || []);
      });
    });
  }

  window.OverlayRendererSkillsModal = {
    renderSkillsModal,
  };
})();
