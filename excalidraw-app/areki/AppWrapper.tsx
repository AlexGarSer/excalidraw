import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ExcalidrawApp from "../App";

import { Login } from "./Login";
import { ArchifyDashboard } from "./ArchifyDashboard";
import { ProtectedRoute } from "./ProtectedRoute";

const Whiteboard = () => (
  <ProtectedRoute>
    <ExcalidrawApp />
  </ProtectedRoute>
);

export const AppWrapper = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* the app resets the URL to the origin (/) after loading
            #room=/#json= links, so / must render the whiteboard too */}
        <Route path="/" element={<Whiteboard />} />
        <Route path="/dashboard" element={<Whiteboard />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/archify"
          element={
            <ProtectedRoute>
              <ArchifyDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
