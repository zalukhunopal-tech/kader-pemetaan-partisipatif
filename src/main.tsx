import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { siapkanAutentikasi } from "./lib/auth";
import { siapkanStorage } from "./lib/storage";
import { pasangPendengarInstal } from "./lib/instal";
import "./styles/app.css";

// Tangkap event pemasangan PWA sedini mungkin agar tombol "Instal" bisa memakainya
pasangPendengarInstal();

// Migrasi akun lama (sandi teks polos -> hash) dan pemuatan data dari IndexedDB selesai
// sebelum aplikasi membaca sesi dan data
Promise.all([siapkanAutentikasi().catch(() => undefined), siapkanStorage().catch(() => undefined)])
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
