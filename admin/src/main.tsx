import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
import { AuthProvider } from "./context/AuthContext";
import { I18nProvider } from "./context/I18nContext";

const storedTheme = (localStorage.getItem("theme") as "light" | "dark") || "light";
document.documentElement.setAttribute("data-theme", storedTheme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>
);
