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
      frameGapTitle: 'Отступ между карточками',
      frameGapLabel: 'Отступ',
      iconsPerRowTitle: 'Спелов в строке',
      iconsPerRowLabel: 'Спелов в строке',
      panelOpacity: 'Прозрачность подложки',
      autoHideWithGameWindow: 'Автоскрытие по окну игры',
      languageRussian: 'Русский',
      languageEnglish: 'English',
      layoutDirection: 'Направление',
      layoutVertical: 'Вертикально',
      layoutHorizontal: 'Горизонтально',
      noFileSelected: 'Папка не выбрана',
      noWatching: 'Нет слежения',
      hudActive: 'HUD активен',
      hudHidden: 'HUD скрыт',
      spirit: 'Spirit',
      trackedClassSkills: 'Отслеживаемые классовые способности',
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
      hotkeyHint: 'Нажмите на кнопку бинда, чтобы его изменить',
      hotkeyListening: 'Нажмите новое сочетание клавиш. Esc для отмены',
      hotkeyDuplicate: 'Этот бинд уже используется',
      hotkeyInvalid: 'Используйте клавишу, а не только модификатор',
      showParty: 'Показывать группу и кулдауны',
      showPull: 'Показывать информацию по пулам и %',
      showRecentSkills: 'Показывать последние скиллы',
      recentSkillsLimit: 'Лимит последних скиллов',
      recentSkillsLayoutDirection: 'Ориентация панели последних скиллов',
      recentSkillsGrowthDirection: 'Рост панели последних скиллов',
      recentSkillsTrackCountRows: 'Строк',
      recentSkillsTrackCountColumns: 'Столбцов',
      recentSkillsTrackCountTitle: 'Лимит сетки',
      growthRight: 'Вправо',
      growthLeft: 'Влево',
      growthDown: 'Вниз',
      growthUp: 'Вверх',
      chooseAbilities: 'Выберите одну или несколько способностей для каждого класса',
      selectedOrder: 'Порядок отображения',
      relics: 'Реликвии',
      skillsEmpty: 'skills.json не найден или пуст',
      unknown: 'Неизвестно',
      errorPrefix: 'Ошибка',
      currentPull: 'Текущий пул',
      pullTotal: 'Всего',
      pullCompleted: 'Набито',
      pullAlive: 'Живой пул',
      pullProjected: 'С пулом',
      noPullData: 'Нет данных по текущему бою',
      recentSkillsTitle: 'Последние скиллы',
      noRecentSkills: 'Нет использованных скиллов',
      chickenizedInfo: 'Chickenize',
      chickenizedSuffix: 'моб(ов) = 0%',
      chickenizedAlive: 'живы',
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
      autoHideWithGameWindow: 'Auto hide with game window',
      languageRussian: 'Русский',
      languageEnglish: 'English',
      layoutDirection: 'Direction',
      layoutVertical: 'Vertical',
      layoutHorizontal: 'Horizontal',
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
      hotkeysSettings: 'Hotkeys',
      hotkeyToggleInteraction: 'Toggle interaction mode',
      hotkeyPickLog: 'Pick log',
      hotkeyToggleVisibility: 'Show or hide overlay',
      hotkeyOpenSettings: 'Open settings',
      hotkeyHint: 'Click a hotkey badge to rebind it',
      hotkeyListening: 'Press a new key combination. Esc to cancel',
      hotkeyDuplicate: 'This hotkey is already in use',
      hotkeyInvalid: 'Use a non-modifier key',
      showParty: 'Show party and cooldowns',
      showPull: 'Show pull and % info',
      showRecentSkills: 'Show recent skills',
      recentSkillsLimit: 'Recent skills limit',
      recentSkillsLayoutDirection: 'Recent skills panel orientation',
      recentSkillsGrowthDirection: 'Recent skills panel growth',
      recentSkillsTrackCountTitle: 'Grid count',
      recentSkillsTrackCountRows: 'Rows',
      recentSkillsTrackCountColumns: 'Columns',
      growthRight: 'Right',
      growthLeft: 'Left',
      growthDown: 'Down',
      growthUp: 'Up',
      chooseAbilities: 'Choose one or more abilities for each class',
      selectedOrder: 'Display order',
      relics: 'Relics',
      skillsEmpty: 'skills.json not found or empty',
      unknown: 'Unknown',
      errorPrefix: 'Error',
      currentPull: 'Current pull',
      pullTotal: 'Total',
      pullCompleted: 'Completed',
      pullAlive: 'Alive pull',
      pullProjected: 'With pull',
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
      autoHideWithWindowToggleLabel,
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
      layoutDirection,
      layoutDirectionLabel,
      layoutDirectionSelect,
      lastWatchStatusMessage,
      latestData,
      logSettingsTitle,
      overlayLocked,
      overlaySettingsTitle,
      panelOpacityLabel,
      pickFileBtn,
      recentSkillsGrowthDirection,
      recentSkillsGrowthDirectionLabel,
      recentSkillsGrowthDirectionSelect,
      recentSkillsLayoutDirection,
      recentSkillsLayoutDirectionLabel,
      recentSkillsLayoutDirectionSelect,
      recentSkillsLimit,
      recentSkillsLimitInput,
      recentSkillsLimitLabel,
      recentSkillsTrackCount,
      recentSkillsTrackCountControls,
      recentSkillsTrackCountLabel,
      recentSkillsTrackCountTitle,
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
    if (autoHideWithWindowToggleLabel) autoHideWithWindowToggleLabel.textContent = translate('autoHideWithGameWindow');
    if (hotkeyToggleInteractionLabel) hotkeyToggleInteractionLabel.textContent = translate('hotkeyToggleInteraction');
    if (hotkeyPickLogLabel) hotkeyPickLogLabel.textContent = translate('hotkeyPickLog');
    if (hotkeyToggleVisibilityLabel) hotkeyToggleVisibilityLabel.textContent = translate('hotkeyToggleVisibility');
    if (hotkeyOpenSettingsLabel) hotkeyOpenSettingsLabel.textContent = translate('hotkeyOpenSettings');
    if (showPartyToggleLabel) showPartyToggleLabel.textContent = translate('showParty');
    if (showPullToggleLabel) showPullToggleLabel.textContent = translate('showPull');
    if (showRecentSkillsToggleLabel) showRecentSkillsToggleLabel.textContent = translate('showRecentSkills');
    if (recentSkillsLimitLabel) recentSkillsLimitLabel.textContent = translate('recentSkillsLimit');
    if (recentSkillsLayoutDirectionLabel) recentSkillsLayoutDirectionLabel.textContent = translate('recentSkillsLayoutDirection');
    if (recentSkillsGrowthDirectionLabel) recentSkillsGrowthDirectionLabel.textContent = translate('recentSkillsGrowthDirection');
    if (recentSkillsTrackCountTitle) recentSkillsTrackCountTitle.textContent = translate('recentSkillsTrackCountTitle');
    if (recentSkillsTrackCountLabel) {
      recentSkillsTrackCountLabel.textContent = recentSkillsLayoutDirection === 'horizontal'
        ? translate('recentSkillsTrackCountRows')
        : translate('recentSkillsTrackCountColumns');
    }
    if (showPartyToggle) showPartyToggle.checked = !!visibilitySettings.showParty;
    if (showPullToggle) showPullToggle.checked = !!visibilitySettings.showPull;
    if (showRecentSkillsToggle) showRecentSkillsToggle.checked = !!visibilitySettings.showRecentSkills;
    recentSkillsLimitInput.value = String(recentSkillsLimit);
    languageSelect.value = currentLanguage;
    const ruOption = languageSelect.querySelector('option[value=\"ru\"]');
    const enOption = languageSelect.querySelector('option[value=\"en\"]');
    if (ruOption) ruOption.textContent = translate('languageRussian');
    if (enOption) enOption.textContent = translate('languageEnglish');

    if (layoutDirectionSelect) {
      layoutDirectionSelect.value = layoutDirection === 'horizontal' ? 'horizontal' : 'vertical';
      const verticalOption = layoutDirectionSelect.querySelector<HTMLOptionElement>('option[value="vertical"]');
      const horizontalOption = layoutDirectionSelect.querySelector<HTMLOptionElement>('option[value="horizontal"]');
      if (verticalOption) verticalOption.textContent = translate('layoutVertical');
      if (horizontalOption) horizontalOption.textContent = translate('layoutHorizontal');
    }

    if (recentSkillsLayoutDirectionSelect) {
      recentSkillsLayoutDirectionSelect.value = recentSkillsLayoutDirection;
      const verticalOption = recentSkillsLayoutDirectionSelect.querySelector<HTMLOptionElement>('option[value="vertical"]');
      const horizontalOption = recentSkillsLayoutDirectionSelect.querySelector<HTMLOptionElement>('option[value="horizontal"]');
      if (verticalOption) verticalOption.textContent = translate('layoutVertical');
      if (horizontalOption) horizontalOption.textContent = translate('layoutHorizontal');
    }

    if (recentSkillsGrowthDirectionSelect) {
      const options = recentSkillsLayoutDirection === 'horizontal'
        ? [
            { value: 'right', label: translate('growthRight') },
            { value: 'left', label: translate('growthLeft') },
          ]
        : [
            { value: 'down', label: translate('growthDown') },
            { value: 'up', label: translate('growthUp') },
          ];
      recentSkillsGrowthDirectionSelect.innerHTML = options
        .map((option) => `<option value="${option.value}">${option.label}</option>`)
        .join('');
      recentSkillsGrowthDirectionSelect.value = recentSkillsGrowthDirection;
    }

    if (cardSizeControls) cardSizeControls.title = translate('cardSizeTitle');
    if (frameGapControls) frameGapControls.title = translate('frameGapTitle');
    if (iconsPerRowControls) iconsPerRowControls.title = translate('iconsPerRowTitle');
    if (recentSkillsTrackCountControls) {
      recentSkillsTrackCountControls.title = recentSkillsLayoutDirection === 'horizontal'
        ? translate('recentSkillsTrackCountRows')
        : translate('recentSkillsTrackCountColumns');
      const valueEl = recentSkillsTrackCountControls.querySelector('span');
      if (valueEl) valueEl.textContent = String(recentSkillsTrackCount);
    }

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
