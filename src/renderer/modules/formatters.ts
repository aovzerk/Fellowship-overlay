(() => {
  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function formatPercent(currentLanguage: LanguageCode, value: unknown): string {
    const number = Number(value || 0);
    const locale = currentLanguage === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(number);
  }

  function formatNumber(currentLanguage: LanguageCode, value: unknown): string {
    const locale = currentLanguage === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  function formatDurationMs(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil((ms || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function formatTimeShort(currentLanguage: LanguageCode, ts: string | null | undefined): string {
    const date = new Date(ts || '');
    if (!Number.isFinite(date.getTime())) return '';
    const locale = currentLanguage === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
  }

  function escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function toAssetSrc(relPath: string | null | undefined): string {
    const normalized = String(relPath || 'game-data/relics/empty.png').replace(/^\.\//, '').replace(/^\/+/, '');
    return `../../${escapeHtml(normalized)}`;
  }

  window.OverlayRendererFormatters = {
    clamp,
    escapeHtml,
    formatDurationMs,
    formatNumber,
    formatPercent,
    formatTimeShort,
    toAssetSrc,
  };
})();
