import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Maps are standalone HTML files produced by tt-a1i/archify. The backend serves
// them behind the session (`/api/mapas`), never bundled into the public build.
const API_BASE = "/api/mapas";

type ArchifyMap = { id: string; tipo: string; titulo: string };

const TIPOS: Record<string, string> = {
  architecture: "Arquitectura",
  workflow: "Flujo de trabajo",
  sequence: "Secuencia",
  dataflow: "Flujo de datos",
  lifecycle: "Ciclo de vida",
};

export const ArchifyDashboard = () => {
  const navigate = useNavigate();
  const [maps, setMaps] = useState<ArchifyMap[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch(API_BASE, { credentials: "same-origin", cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((list: ArchifyMap[]) => {
        setMaps(list);
        setSelected((current) => current ?? list[0]?.id ?? null);
      })
      .catch((err) => setError(`No se pudo leer el catálogo (${err.message})`));
  }, []);

  return (
    <div className="areki-archify">
      <aside className="areki-archify__sidebar">
        <button
          type="button"
          className="areki-archify__back"
          onClick={() => navigate("/dashboard")}
        >
          ← Volver a la pizarra
        </button>
        <h2>Archify OSINT Maps</h2>
        {error && <p className="areki-archify__error">{error}</p>}
        {!maps && !error && <p>Cargando…</p>}
        {maps && !maps.length && <p>No hay mapas publicados en el servidor.</p>}
        <ul>
          {maps?.map((map) => (
            <li key={map.id}>
              <button
                type="button"
                aria-current={map.id === selected}
                onClick={() => setSelected(map.id)}
              >
                <span>{TIPOS[map.tipo] ?? map.tipo}</span>
                {map.titulo}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {selected && (
        <iframe
          title="Mapa Archify"
          className="areki-archify__map"
          src={`${API_BASE}/${encodeURIComponent(selected)}`}
          // the backend also sends a CSP sandbox; keep the map away from the
          // session and the parent page even if that header is lost
          sandbox="allow-scripts allow-downloads"
        />
      )}
    </div>
  );
};
