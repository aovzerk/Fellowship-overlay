(() => {
  const I18N: Record<LanguageCode, Record<string, string>> = {
    ru: {
      htmlLang: 'ru',
      pickLog: 'Выбрать папку',
      reload: 'Обновить',
      lockOverlay: 'Lock overlay',
      unlockOverlay: 'Unlock overlay',
      skills: 'Skills',
      language: 'Язык',
      cardSizeTitle: 'Размер карточки',
      noFileSelected: 'Папка не выбрана',
      noWatching: 'Нет слежения',
      hudActive: 'HUD active',
      hudHidden: 'HUD hidden',
      spirit: 'Spirit',
      trackedClassSkills: 'Отслеживаемые способности классов',
      settings: 'Настройки',
      settingsSubtitle: 'Общие настройки оверлея',
      logSettings: 'Лог',
      overlaySettings: 'Оверлей',
      appearanceSettings: 'Внешний вид',
      showParty: 'Показывать группу и кулдауны',
      showPull: 'Показывать информацию по пулам и %',
      showRecentSkills: 'Показывать последние скиллы',
      recentSkillsLimit: 'Лимит последних скиллов',
      chooseAbilities: 'Выберите одну или несколько способностей для каждого класса',
      skillsEmpty: 'skills.json не найден или пуст',
      unknown: 'Неизвестно',
      errorPrefix: 'Ошибка',
      currentPull: 'Текущий пул',
      pullTotal: 'Всего',
      noPullData: 'Нет данных по текущему бою',
      recentSkillsTitle: 'Последние скиллы',
      noRecentSkills: 'Нет использованных скиллов',
      chickenizedInfo: 'Chickenize',
      chickenizedSuffix: 'моб(ов) = 0%',
      chickenizedAlive: 'живых',
    },
    en: {
      htmlLang: 'en',
      pickLog: 'Select folder',
      reload: 'Refresh',
      lockOverlay: 'Lock overlay',
      unlockOverlay: 'Unlock overlay',
      skills: 'Skills',
      language: 'Language',
      cardSizeTitle: 'Card size',
      noFileSelected: 'No folder selected',
      noWatching: 'Not watching',
      hudActive: 'HUD active',
      hudHidden: 'HUD hidden',
      spirit: 'Spirit',
      trackedClassSkills: 'Tracked class skills',
      settings: 'Settings',
      settingsSubtitle: 'General overlay settings',
      logSettings: 'Log',
      overlaySettings: 'Overlay',
      appearanceSettings: 'Appearance',
      showParty: 'Show party and cooldowns',
      showPull: 'Show pull and % info',
      showRecentSkills: 'Show recent skills',
      recentSkillsLimit: 'Recent skills limit',
      chooseAbilities: 'Choose one or more abilities for each class',
      skillsEmpty: 'skills.json not found or empty',
      unknown: 'Unknown',
      errorPrefix: 'Error',
      currentPull: 'Current pull',
      pullTotal: 'Total',
      noPullData: 'No current pull data',
      recentSkillsTitle: 'Recent skills',
      noRecentSkills: 'No used skills yet',
      chickenizedInfo: 'Chickenize',
      chickenizedSuffix: 'mob(s) = 0%',
      chickenizedAlive: 'alive',
    },
  };

  function t(currentLanguage: LanguageCode, key: string): string {
    return I18N[currentLanguage]?.[key] || I18N.en[key] || key;
  }

  function setLogSourceText(filePathEl: HTMLElement, translate: (key: string) => string, source: LogSourceInfo | null | undefined): void {
    const text = source?.filePath || source?.directoryPath || translate('noFileSelected');
    filePathEl.textContent = text;
  }

  function applyTranslations(ctx: ApplyTranslationsContext): void {
    const {
      appearanceSettingsTitle,
      currentLanguage,
      filePathEl,
      languageLabel,
      languageSelect,
      latestData,
      overlayLocked,
      overlaySettingsTitle,
      pickFileBtn,
      recentSkillsLimit,
      recentSkillsLimitInput,
      recentSkillsLimitLabel,
      reloadBtn,
      renderPlayers,
      renderPullInfo,
      renderRecentSkillsPanel,
      renderSkillsModal,
      setHudActiveState,
      settingsModalSubtitle,
      settingsModalTitle,
      showPartyToggle,
      showPartyToggleLabel,
      showPullToggle,
      showPullToggleLabel,
      showRecentSkillsToggle,
      showRecentSkillsToggleLabel,
      skillsBtn,
      skillsModalSubtitle,
      skillsModalTitle,
      toggleLockBtn,
      updateOverlayVisibility,
      updatePullPanelVisibility,
      updateRecentSkillsPanelVisibility,
      visibilitySettings,
      watchStatusEl,
      lastWatchStatusMessage,
      logSettingsTitle,
    } = ctx;

    const translate = (key: string) => t(currentLanguage, key);

    document.documentElement.lang = translate('htmlLang');
    settingsModalTitle.textContent = translate('settings');
    settingsModalSubtitle.textContent = translate('settingsSubtitle');
    logSettingsTitle.textContent = translate('logSettings');
    overlaySettingsTitle.textContent = translate('overlaySettings');
    appearanceSettingsTitle.textContent = translate('appearanceSettings');
    pickFileBtn.textContent = translate('pickLog');
    reloadBtn.textContent = translate('reload');
    toggleLockBtn.textContent = overlayLocked ? translate('unlockOverlay') : translate('lockOverlay');
    skillsBtn.textContent = translate('skills');
    languageLabel.textContent = translate('language');
    if (showPartyToggleLabel) showPartyToggleLabel.textContent = translate('showParty');
    if (showPullToggleLabel) showPullToggleLabel.textContent = translate('showPull');
    if (showRecentSkillsToggleLabel) showRecentSkillsToggleLabel.textContent = translate('showRecentSkills');
    if (recentSkillsLimitLabel) recentSkillsLimitLabel.textContent = translate('recentSkillsLimit');
    if (showPartyToggle) showPartyToggle.checked = !!visibilitySettings.showParty;
    if (showPullToggle) showPullToggle.checked = !!visibilitySettings.showPull;
    if (showRecentSkillsToggle) showRecentSkillsToggle.checked = !!visibilitySettings.showRecentSkills;
    recentSkillsLimitInput.value = String(recentSkillsLimit);
    languageSelect.value = currentLanguage;
    const sizeControls = document.querySelector<HTMLElement>('.size-controls');
    if (sizeControls) sizeControls.title = translate('cardSizeTitle');
    if (!filePathEl.textContent || filePathEl.textContent === I18N.en.noFileSelected || filePathEl.textContent === I18N.ru.noFileSelected) {
      filePathEl.textContent = translate('noFileSelected');
    }
    watchStatusEl.textContent = lastWatchStatusMessage || translate('noWatching');
    skillsModalTitle.textContent = translate('trackedClassSkills');
    skillsModalSubtitle.textContent = translate('chooseAbilities');
    updateOverlayVisibility();
    updatePullPanelVisibility();
    renderPullInfo(latestData?.currentPull, latestData?.dungeon);
    renderRecentSkillsPanel(latestData?.recentSkills || []);
    if (!latestData?.players?.length) {
      setHudActiveState(ctx.hudActive);
    } else {
      renderPlayers(latestData.players || []);
    }
    renderSkillsModal();
    updateRecentSkillsPanelVisibility();
  }

  window.OverlayRendererI18n = {
    I18N,
    applyTranslations,
    setLogSourceText,
    t,
  };
})();
