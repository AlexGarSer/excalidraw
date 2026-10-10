import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { fetchSession } from "./auth";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">(
    "checking",
  );

  useEffect(() => {
    let cancelled = false;
    fetchSession().then((session) => {
      if (!cancelled) {
        setStatus(session ? "allowed" : "denied");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") {
    return null;
  }

  if (status === "denied") {
    // keep path + hash (e.g. #room=...) so collab links survive the login
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.hash}` }}
      />
    );
  }

  return <>{children}</>;
};
