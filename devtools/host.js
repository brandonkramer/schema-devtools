/**
 * DevTools-page helpers. Never imported by `src/` or evaluated in the inspected page.
 */

/**
 * @param {{ addListener?: (handler: (...args: unknown[]) => void) => void } | null | undefined} event
 * @param {(...args: unknown[]) => void} handler
 */
export function listen(event, handler) {
  if (event && typeof event.addListener === 'function') {
    event.addListener(handler);
    return true;
  }
  return false;
}

/**
 * Format `inspectedWindow.eval` exceptionInfo.
 * DevTools-side failures use `description` templates such as `Operation failed: %s`
 * with substitutions in `details`. Page exceptions use `value`.
 * Official: https://developer.chrome.com/docs/extensions/reference/api/devtools/inspectedWindow
 * (reviewed 2026-08-26)
 *
 * @param {Record<string, unknown> | null | undefined} exceptionInfo
 */
export function formatEvalException(exceptionInfo) {
  if (!exceptionInfo || typeof exceptionInfo !== 'object') {
    return 'Evaluation failed';
  }
  const details = Array.isArray(exceptionInfo.details)
    ? exceptionInfo.details.map((item) => String(item))
    : [];
  const description = typeof exceptionInfo.description === 'string'
    ? exceptionInfo.description
    : '';
  if (description.includes('%s')) {
    let index = 0;
    const filled = description.replace(/%s/g, () => details[index++] ?? '').replace(/\s+/g, ' ').trim();
    if (filled && !/%s/.test(filled) && !filled.endsWith(':')) return filled;
  }
  const value = exceptionInfo.value;
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object' && 'message' in value && value.message) {
    return String(value.message);
  }
  if (description && !description.includes('%s')) return description;
  if (typeof exceptionInfo.code === 'string' && exceptionInfo.code) {
    return `Page evaluation failed (${exceptionInfo.code}). Restricted or navigated-away pages cannot be inspected.`;
  }
  if (details.length) return details.join(' ');
  return 'Evaluation failed';
}
