import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { siapkanAutentikasi } from "./lib/auth";
import "./styles/app.css";

// Migrasi akun lama (sandi teks polos -> hash) selesai sebelum aplikasi membaca sesi
siapkanAutentikasi()
  .catch(() => undefined)
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
