import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import React, { useEffect, useRef, useState } from "react";

import { fetchCaseScenes, loadCaseScene } from "./caseScenes";

import type { CaseScene } from "./caseScenes";

const overwriteConfirmDialog = {
  title: "Reemplazar el lienzo",
  description: (
    <>
      El diagrama reemplazará lo que hay en el lienzo.
      <br />
      Si quieres conservarlo, guárdalo antes (menú → Guardar en…).
    </>
  ),
  actionLabel: "Reemplazar",
  color: "danger",
} as const;

export const CaseScenesDialog = ({ onClose }: { onClose: () => void }) => {
  const excalidrawAPI = useExcalidrawAPI();
  const rootRef = useRef<HTMLDivElement>(null);
  const [scenes, setScenes] = useState<CaseScene[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCaseScenes()
      .then(setScenes)
      .catch((err) => setError(`No se pudo leer el catálogo (${err.message})`));
  }, []);

  const open = async (scene: CaseScene) => {
    if (!excalidrawAPI) {
      return;
    }
    if (
      excalidrawAPI.getSceneElements().length &&
      !(await openConfirmModal(overwriteConfirmDialog))
    ) {
      return;
    }
    setLoadingId(scene.id);
    try {
      await loadCaseScene(
        excalidrawAPI,
        scene.id,
        rootRef.current?.ownerDocument ?? document,
      );
      onClose();
    } catch (err: any) {
      setError(`No se pudo abrir ${scene.id} (${err.message})`);
    } finally {
      setLoadingId(null);
    }
  };

  const bloques = [...new Set((scenes ?? []).map((scene) => scene.bloque))];

  return (
    <Dialog size="regular" onCloseRequest={onClose} title="Diagramas del caso">
      <div ref={rootRef} className="areki-case-scenes">
        {error && <p className="areki-case-scenes__error">{error}</p>}
        {!scenes && !error && <p>Cargando…</p>}
        {scenes && !scenes.length && (
          <p>No hay diagramas publicados en el servidor.</p>
        )}
        {bloques.map((bloque) => (
          <section key={bloque}>
            <h3>Bloque {bloque}</h3>
            <ul>
              {scenes!
                .filter((scene) => scene.bloque === bloque)
                .map((scene) => (
                  <li key={scene.id}>
                    <button
                      type="button"
                      disabled={!!loadingId}
                      onClick={() => open(scene)}
                      title={`Fuente: ${scene.fuente}`}
                    >
                      <strong>{scene.id}</strong> · {scene.titulo}
                      {loadingId === scene.id && " …"}
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
};
