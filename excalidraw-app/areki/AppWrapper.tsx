import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ExcalidrawApp from "../App";
import { Login } from "./Login";
import { ArchifyDashboard } from "./ArchifyDashboard";

export const AppWrapper = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ExcalidrawApp />} />
        <Route path="/archify" element={<ArchifyDashboard />} />
      </Routes>
    </BrowserRouter>
  );
};
