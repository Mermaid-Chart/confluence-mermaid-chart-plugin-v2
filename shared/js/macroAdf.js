/**
 * Writes a synced diagram into Mermaid Chart macro ADF. Used by the backend for the
 * published page.
 */

const extensionTypes = new Set(['extension', 'bodiedExtension', 'inlineExtension']);

function differs(current, next) {
  return current.diagramCode !== next.diagramCode || current.mcSourceCode !== next.mcSourceCode;
}

/**
 * Writes the diagram into every macro in `adf` linked to `documentID`; `adf` may be a whole
 * page or a single macro node. Forge macros keep their config in `guestParams`; macros saved
 * by the old Connect app keep it in `macroParams` as `{ value }` objects.
 * @returns {{ matched: number, changed: number }}
 */
export function applyDiagramToAdf(adf, documentID, { diagramCode, mcSourceCode, updatedAt }) {
  const next = { diagramCode, mcSourceCode };
  let matched = 0;
  let changed = 0;

  const visit = (node) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    const parameters = extensionTypes.has(node.type) ? node.attrs?.parameters : undefined;
    const guestParams = parameters?.guestParams;
    const macroParams = parameters?.macroParams;
    if (guestParams?.documentID === documentID) {
      matched += 1;
      if (differs(guestParams, next)) {
        Object.assign(guestParams, next, { updatedAt });
        changed += 1;
      }
    } else if (macroParams?.documentID?.value === documentID) {
      matched += 1;
      const current = {
        diagramCode: macroParams.diagramCode?.value,
        mcSourceCode: macroParams.mcSourceCode?.value,
      };
      if (differs(current, next)) {
        for (const [key, value] of Object.entries({ ...next, updatedAt })) {
          macroParams[key] = { value };
        }
        changed += 1;
      }
    }
    for (const child of Array.isArray(node.content) ? node.content : []) {
      visit(child);
    }
  };

  visit(adf);
  return { matched, changed };
}
