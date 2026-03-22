(() => {
  const { clamp } = window.OverlayRendererFormatters;

  function getDefaultPosition(index: number): Point {
    return { x: 16, y: 64 + index * 122 };
  }

  function getScaledMetrics(cardScale: number): { scale: number; iconSize: number; iconGap: number; horizontalPadding: number; baseMinWidth: number } {
    const scale = Number(cardScale || 1);
    const iconSize = Math.round(60 * scale);
    const iconGap = Math.max(6, Math.round(8 * scale));
    const horizontalPadding = Math.round(20 * scale);
    const baseMinWidth = Math.round(180 * scale);
    return { scale, iconSize, iconGap, horizontalPadding, baseMinWidth };
  }

  function getCardWidthForIconCount(cardScale: number, iconCount: number): number {
    const { iconSize, iconGap, horizontalPadding, baseMinWidth } = getScaledMetrics(cardScale);
    if (!iconCount) return baseMinWidth;
    return Math.max(baseMinWidth, horizontalPadding + (iconCount * iconSize) + (Math.max(0, iconCount - 1) * iconGap));
  }

  function applyCardLayout(card: HTMLElement, cardScale: number, iconCount = 0): void {
    card.style.width = `${getCardWidthForIconCount(cardScale, iconCount)}px`;
  }

  function makeCardDraggable({
    card,
    dragHandle,
    getOverlayLocked,
    getPlayerLayoutKey,
    layoutKey,
    positions,
    savePositions,
  }: MakeCardDraggableArgs): void {
    let dragging = false;
    let startMouseX = 0;
    let startMouseY = 0;
    let startLeft = 0;
    let startTop = 0;

    function onMove(e: MouseEvent): void {
      if (!dragging) return;
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      const maxX = Math.max(0, window.innerWidth - card.offsetWidth - 6);
      const maxY = Math.max(0, window.innerHeight - card.offsetHeight - 6);
      const left = clamp(startLeft + dx, 0, maxX);
      const top = clamp(startTop + dy, 0, maxY);
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
      const resolvedLayoutKey = layoutKey || card.dataset.layoutKey || getPlayerLayoutKey(0);
      positions[resolvedLayoutKey] = { x: left, y: top };
    }

    function onUp(): void {
      if (!dragging) return;
      dragging = false;
      savePositions(positions);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    dragHandle.addEventListener('mousedown', (e: MouseEvent) => {
      if (!getOverlayLocked()) return;
      dragging = true;
      startMouseX = e.clientX;
      startMouseY = e.clientY;
      startLeft = parseFloat(card.style.left || '0');
      startTop = parseFloat(card.style.top || '0');
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      e.preventDefault();
      e.stopPropagation();
    });
  }

  function makePanelDraggable({ panel, getDragHandle, getOverlayLocked, savePosition, fallbackSavePosition }: InitializePanelArgs): void {
    let dragging = false;
    let startMouseX = 0;
    let startMouseY = 0;
    let startLeft = 0;
    let startTop = 0;

    function onMove(e: MouseEvent): void {
      if (!dragging) return;
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      const maxX = Math.max(0, window.innerWidth - panel.offsetWidth - 6);
      const maxY = Math.max(0, window.innerHeight - panel.offsetHeight - 6);
      const left = clamp(startLeft + dx, 0, maxX);
      const top = clamp(startTop + dy, 0, maxY);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    }

    function onUp(): void {
      if (!dragging) return;
      dragging = false;
      const position: Point = {
        x: parseFloat(panel.style.left || '16'),
        y: parseFloat(panel.style.top || '12'),
      };
      if (typeof savePosition === 'function') savePosition(position);
      else if (typeof fallbackSavePosition === 'function') fallbackSavePosition(position);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    panel.addEventListener('mousedown', (e: MouseEvent) => {
      const dragHandle = getDragHandle();
      if (!dragHandle || !(e.target instanceof Node) || !dragHandle.contains(e.target)) return;
      if (!getOverlayLocked()) return;
      dragging = true;
      startMouseX = e.clientX;
      startMouseY = e.clientY;
      startLeft = parseFloat(panel.style.left || '0');
      startTop = parseFloat(panel.style.top || '0');
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      e.preventDefault();
      e.stopPropagation();
    });
  }

  function initializePanel({ panel, position, getDragHandle, getOverlayLocked, savePosition, fallbackSavePosition }: InitializePanelArgs): void {
    panel.style.left = `${position.x}px`;
    panel.style.top = `${position.y}px`;
    panel.classList.add('interactive');
    panel.classList.add('hidden');
    makePanelDraggable({ panel, position, getDragHandle, getOverlayLocked, savePosition, fallbackSavePosition });
  }

  window.OverlayRendererLayout = {
    applyCardLayout,
    getCardWidthForIconCount,
    getDefaultPosition,
    getScaledMetrics,
    initializePanel,
    makeCardDraggable,
  };
})();
