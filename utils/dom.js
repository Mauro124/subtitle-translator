/**
 * DOM Utilities for Multi-Platform Support
 */

/**
 * Recursively find an element by selector, even inside Open Shadow Roots.
 * @param {Element|ShadowRoot} root - The starting node to search from.
 * @param {string} selector - The CSS selector to find.
 * @returns {Element|null}
 */
function findElementRecursive(root, selector) {
  if (!root) return null;
  
  // 1. Try direct match/selection
  const found = (root instanceof Element && root.matches(selector)) 
    ? root 
    : root.querySelector(selector);
  if (found) return found;

  // 2. Search children
  const children = root.children || (root.childNodes ? Array.from(root.childNodes).filter(n => n instanceof Element) : []);
  for (const child of children) {
    const result = findElementRecursive(child, selector);
    if (result) return result;
  }

  // 3. Search Shadow Roots
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      const result = findElementRecursive(el.shadowRoot, selector);
      if (result) return result;
    }
  }

  return null;
}
