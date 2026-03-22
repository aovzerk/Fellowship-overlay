(() => {
  const I18N: Record<LanguageCode, Record<string, string>> = {
    ru: {
      htmlLang: 'ru',
      pickLog: 'Выбрать папку',
      reload: 'Обновить',
      lockOverlay: 'Закрепить оверлей',
      unlockOverlay: 'Разблокировать оверлей',
      skills: 'Способности',
      language: 'Язык',
      cardSizeTitle: 'Размер карточки',
      cardSizeLabel: 'Размер карточки',
      frameGapTitle: 'Отступ между фреймами',
      frameGapLabel: 'Отступ',
      iconsPerRowTitle: 'Спелов в строке',
      iconsPerRowLabel: 'Спелов в строке',
      panelOpacity: 'Прозрачность подложки',
      layoutDirection: 'Направление',
      layoutVertical: 'Вертикально',
      layoutHorizontal: 'Горизонтально',
      noFileSelected: 'Папка не выбрана',
      noWatching: 'Нет слежения',
      hudActive: 'HUD active',
      hudHidden: 'HUD hidden',
      spirit: 'Spirit',
      trackedClassSkills: 'Отслеживаемые способности классов',
      selectedOrder: 'Порядок на карточке',
      relics: 'Реликвии',
      settings: 'Настройки',
      settingsSubtitle: 'Общие настройки оверлея',
      logSettings: 'Лог',
      overlaySettings: 'Оверлей',
      appearanceSettings: 'Внешний вид',
      hotkeysSettings: 'Горячие клавиши',
      hotkeyToggleInteraction: 'Переключить режим взаимодействия',
      hotkeyPickLog: 'Выбрать лог',
      hotkeyToggleVisibility: 'Показать или скрыть оверлей',
      hotkeyOpenSettings: 'Открыть настройки',
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
      tooltipLogSection: 'Выбор папки лога и ручное обновление текущего файла',
      tooltipPickLog: 'Выбрать папку логов для новой версии оверлея',
      tooltipReload: 'Принудительно перечитать текущий активный лог',
      tooltipOverlaySection: 'Управление взаимодействием с HUD и списком отслеживаемых способностей',
      tooltipToggleLock: 'Переключить режим взаимодействия с оверлеем',
      tooltipSkills: 'Открыть список способностей и порядок их отображения на карточке',
      tooltipAppearanceSection: 'Настройка раскладки, плотности и прозрачности карточек',
      tooltipLanguage: 'Переключить язык интерфейса',
      tooltipLayoutDirection: 'Выбрать направление раскладки группы',
      tooltipFrameGap: 'Изменить расстояние между карточками игроков',
      tooltipIconsPerRow: 'Ограничить количество иконок в одной строке',
      tooltipCardSize: 'Изменить общий масштаб HUD',
      tooltipPanelOpacity: 'Настроить прозрачность фоновой подложки карточек и окон',
      tooltipHotkeysSection: 'Справка по доступным глобальным горячим клавишам',
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
      cardSizeLabel: 'Card size',
      frameGapTitle: 'Frame gap',
      frameGapLabel: 'Frame gap',
      iconsPerRowTitle: 'Spells per row',
      iconsPerRowLabel: 'Spells per row',
      panelOpacity: 'Panel opacity',
      layoutDirection: 'Direction',
      layoutVertical: 'Vertical',
      layoutHorizontal: 'Horizontal',
      noFileSelected: 'No folder selected',
      noWatching: 'Not watching',
      hudActive: 'HUD active',
      hudHidden: 'HUD hidden',
      spirit: 'Spirit',
      trackedClassSkills: 'Tracked class skills',
      selectedOrder: 'Card order',
      relics: 'Relics',
      settings: 'Settings',
      settingsSubtitle: 'General overlay settings',
      logSettings: 'Log',
      overlaySettings: 'Overlay',
      appearanceSettings: 'Appearance',
      hotkeysSettings: 'Hotkeys',
      hotkeyToggleInteraction: 'Toggle interaction mode',
      hotkeyPickLog: 'Pick log',
      hotkeyToggleVisibility: 'Show or hide overlay',
      hotkeyOpenSettings: 'Open settings',
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
      tooltipLogSection: 'Choose the log folder and refresh the current file manually',
      tooltipPickLog: 'Select the log folder used by the new overlay version',
      tooltipReload: 'Force reload the currently active log',
      tooltipOverlaySection: 'Control HUD interaction mode and tracked abilities',
      tooltipToggleLock: 'Toggle whether the overlay can be clicked and moved',
      tooltipSkills: 'Open tracked abilities and their order on player cards',
      tooltipAppearanceSection: 'Adjust card layout, density, and transparency',
      tooltipLanguage: 'Switch the interface language',
      tooltipLayoutDirection: 'Choose how party cards are arranged',
      tooltipFrameGap: 'Adjust spacing between player cards',
      tooltipIconsPerRow: 'Limit how many tracked icons fit into one row',
      tooltipCardSize: 'Change the overall scale of HUD cards',
      tooltipPanelOpacity: 'Adjust background opacity of cards and modals',
      tooltipHotkeysSection: 'Reference for available global hotkeys',
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
      cardSizeControls,
      cardSizeLabel,
      currentLanguage,
      filePathEl,
      frameGapControls,
      frameGapLabel,
      hotkeyOpenSettingsLabel,
      hotkeyPickLogLabel,
      hotkeyToggleInteractionLabel,
      hotkeyToggleVisibilityLabel,
      hotkeysSettingsTitle,
      hudActive,
      iconsPerRowControls,
      iconsPerRowLabel,
      languageLabel,
      languageSelect,
      layoutDirectionLabel,
      layoutDirectionSelect,
      lastWatchStatusMessage,
      latestData,
      logSettingsTitle,
      overlayLocked,
      overlaySettingsTitle,
      panelOpacityLabel,
      pickFileBtn,
      recentSkillsLimit,
      recentSkillsLimitInput,
      recentSkillsLimitLabel,
      recentSkillsPanelEl,
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
    } = ctx;

    const translate = (key: string) => t(currentLanguage, key);

    document.documentElement.lang = translate('htmlLang');
    settingsModalTitle.textContent = translate('settings');
    settingsModalSubtitle.textContent = translate('settingsSubtitle');
    logSettingsTitle.textContent = translate('logSettings');
    overlaySettingsTitle.textContent = translate('overlaySettings');
    appearanceSettingsTitle.textContent = translate('appearanceSettings');
    if (hotkeysSettingsTitle) hotkeysSettingsTitle.textContent = translate('hotkeysSettings');
    pickFileBtn.textContent = translate('pickLog');
    reloadBtn.textContent = translate('reload');
    toggleLockBtn.textContent = overlayLocked ? translate('unlockOverlay') : translate('lockOverlay');
    skillsBtn.textContent = translate('skills');
    languageLabel.textContent = translate('language');
    if (layoutDirectionLabel) layoutDirectionLabel.textContent = translate('layoutDirection');
    if (cardSizeLabel) cardSizeLabel.textContent = translate('cardSizeLabel');
    if (frameGapLabel) frameGapLabel.textContent = translate('frameGapLabel');
    if (iconsPerRowLabel) iconsPerRowLabel.textContent = translate('iconsPerRowLabel');
    if (panelOpacityLabel) panelOpacityLabel.textContent = translate('panelOpacity');
    if (hotkeyToggleInteractionLabel) hotkeyToggleInteractionLabel.textContent = translate('hotkeyToggleInteraction');
    if (hotkeyPickLogLabel) hotkeyPickLogLabel.textContent = translate('hotkeyPickLog');
    if (hotkeyToggleVisibilityLabel) hotkeyToggleVisibilityLabel.textContent = translate('hotkeyToggleVisibility');
    if (hotkeyOpenSettingsLabel) hotkeyOpenSettingsLabel.textContent = translate('hotkeyOpenSettings');
    if (showPartyToggleLabel) showPartyToggleLabel.textContent = translate('showParty');
    if (showPullToggleLabel) showPullToggleLabel.textContent = translate('showPull');
    if (showRecentSkillsToggleLabel) showRecentSkillsToggleLabel.textContent = translate('showRecentSkills');
    recentSkillsLimitLabel.textContent = translate('recentSkillsLimit');
    if (showPartyToggle) showPartyToggle.checked = !!visibilitySettings.showParty;
    if (showPullToggle) showPullToggle.checked = !!visibilitySettings.showPull;
    if (showRecentSkillsToggle) showRecentSkillsToggle.checked = !!visibilitySettings.showRecentSkills;
    recentSkillsLimitInput.value = String(recentSkillsLimit);
    languageSelect.value = currentLanguage;
    if (layoutDirectionSelect) {
      layoutDirectionSelect.value = ctx.layoutDirection === 'horizontal' ? 'horizontal' : 'vertical';
      const verticalOption = layoutDirectionSelect.querySelector<HTMLOptionElement>('option[value="vertical"]');
      const horizontalOption = layoutDirectionSelect.querySelector<HTMLOptionElement>('option[value="horizontal"]');
      if (verticalOption) verticalOption.textContent = translate('layoutVertical');
      if (horizontalOption) horizontalOption.textContent = translate('layoutHorizontal');
    }
    if (cardSizeControls) cardSizeControls.title = translate('tooltipCardSize');
    if (frameGapControls) frameGapControls.title = translate('tooltipFrameGap');
    if (iconsPerRowControls) iconsPerRowControls.title = translate('tooltipIconsPerRow');
    if (recentSkillsPanelEl) recentSkillsPanelEl.title = translate('recentSkillsTitle');
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
      setHudActiveState(hudActive);
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
