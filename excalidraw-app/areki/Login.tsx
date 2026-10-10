import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { fetchSession, getExternalNext, login } from "./auth";
import { ObsidianGraph } from "./ObsidianGraph";

import "./Login.scss";

// the backend answers in English; show the known messages in Spanish
const errorMessages: Record<string, string> = {
  "Invalid credentials": "Usuario o contraseña incorrectos.",
  "Too many failed attempts, try again later":
    "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.",
  "Could not reach the server": "No se pudo conectar con el servidor.",
  "Login failed": "No se pudo iniciar sesión. Inténtalo de nuevo.",
};

const EyeIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="12"
      r="3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    {!open && (
      <path
        d="M4 4l16 16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    )}
  </svg>
);

export const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/";
  // set by sibling sites that share this login (vault.areki.mx)
  const externalNext = getExternalNext(
    location.search,
    window.location.hostname,
  );

  const goNext = useCallback(() => {
    if (externalNext) {
      window.location.assign(externalNext);
    } else {
      navigate(from, { replace: true });
    }
  }, [externalNext, from, navigate]);

  // skip the form when there's already a valid session
  useEffect(() => {
    fetchSession().then((session) => {
      if (session) {
        goNext();
      }
    });
  }, [goNext]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await login(username, password);
    setSubmitting(false);
    if (result.ok) {
      goNext();
    } else {
      setError(errorMessages[result.message] || result.message);
    }
  };

  const handlePasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState("CapsLock"));
  };

  return (
    <div className="areki-login">
      <aside className="areki-login__showcase">
        <div className="areki-login__brand">
          <span className="areki-login__logo" aria-hidden="true">
            A
          </span>
          Areki
        </div>
        <ObsidianGraph className="areki-login__graph" />
        <p className="areki-login__tagline">
          Conecta personas, cuentas y dominios en un solo lienzo.
        </p>
      </aside>

      <main className="areki-login__panel">
        <form className="areki-login__form" onSubmit={handleLogin} noValidate>
          <div className="areki-login__brand areki-login__brand--compact">
            <span className="areki-login__logo" aria-hidden="true">
              A
            </span>
            Areki
          </div>

          <header>
            <h1 className="areki-login__title">Iniciar sesión</h1>
            <p className="areki-login__subtitle">
              Accede al tablero de investigación OSINT.
            </p>
          </header>

          <label className="areki-login__field">
            <span>Usuario</span>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={!!error}
              required
              autoFocus
            />
          </label>

          <label className="areki-login__field">
            <span>Contraseña</span>
            <div className="areki-login__password">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handlePasswordKey}
                onKeyUp={handlePasswordKey}
                aria-invalid={!!error}
                required
              />
              <button
                type="button"
                className="areki-login__reveal"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                aria-pressed={showPassword}
              >
                <EyeIcon open={!showPassword} />
              </button>
            </div>
          </label>

          {capsLock && (
            <p className="areki-login__hint">Bloq Mayús está activado.</p>
          )}

          {error && (
            <p className="areki-login__error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="areki-login__submit"
            disabled={submitting || !username || !password}
          >
            {submitting ? "Entrando…" : "Entrar"}
          </button>

          <p className="areki-login__footnote">
            Acceso restringido. La sesión caduca automáticamente.
          </p>
        </form>
      </main>
    </div>
  );
};
