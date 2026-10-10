import { CaptureUpdateAction, Fonts } from "@excalidraw/excalidraw";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

// Scenes are served by the backend behind the session (`/api/escenas`), never
// bundled into the public frontend build.
const API_BASE = "/api/escenas";

// keep in sync with BOUND_TEXT_PADDING in @excalidraw/common
const BOUND_TEXT_PADDING = 5;

export type CaseScene = {
  id: string;
  tramo: string;
  bloque: string;
  titulo: string;
  fuente: string;
};

export const fetchCaseScenes = async (): Promise<CaseScene[]> => {
  const response = await fetch(API_BASE, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

/**
 * Scenes are generated programmatically, so their text sizes are estimates.
 * Load the fonts first, then let Excalidraw re-measure and re-wrap every text
 * and center the labels inside their containers.
 */
const fitTexts = async (
  elements: readonly ExcalidrawElement[],
  ownerDocument: Document,
) => {
  await Fonts.loadElementsFonts(elements, ownerDocument);

  const restored = restoreElements(elements, null, {
    refreshDimensions: true,
    repairBindings: true,
  });
  const byId = new Map(restored.map((element) => [element.id, element]));

  return restored.map((element) => {
    if (element.type !== "text" || !element.containerId) {
      return element;
    }
    const container = byId.get(element.containerId);
    if (!container || container.type === "arrow") {
      return element;
    }
    const x =
      element.textAlign === "left"
        ? container.x + BOUND_TEXT_PADDING
        : container.x + (container.width - element.width) / 2;
    const y =
      element.verticalAlign === "top"
        ? container.y + BOUND_TEXT_PADDING
        : container.y + (container.height - element.height) / 2;
    return { ...element, x, y };
  });
};

export const loadCaseScene = async (
  excalidrawAPI: ExcalidrawImperativeAPI,
  id: string,
  ownerDocument: Document,
) => {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await loadFromBlob(await response.blob(), null, null);

  excalidrawAPI.updateScene({
    elements: await fitTexts(data.elements, ownerDocument),
    appState: { viewBackgroundColor: data.appState.viewBackgroundColor },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  excalidrawAPI.setViewport({
    target: excalidrawAPI.getSceneElements(),
    fit: "contain",
    animation: false,
    offsets: { ui: true },
  });
};
