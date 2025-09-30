import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
];

const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS.join(','))).filter((element) => {
    if (element.hasAttribute('disabled')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    if (element.tabIndex === -1) return false;
    if (element instanceof HTMLElement && element.offsetParent === null && element !== document.activeElement) {
      // Hidden via CSS; skip it unless it's currently focused (e.g. during transitions).
      return false;
    }
    return true;
  });
};

export interface FocusTrapOptions {
  initialFocusRef?: RefObject<HTMLElement>;
}

export const useFocusTrap = (
  containerRef: RefObject<HTMLElement>,
  active: boolean,
  options: FocusTrapOptions = {},
): void => {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusFirstElement = () => {
      const focusTarget = options.initialFocusRef?.current ?? getFocusableElements(container)[0];
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus();
      }
    };

    focusFirstElement();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (activeElement === first || !container.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef, options.initialFocusRef]);
};
