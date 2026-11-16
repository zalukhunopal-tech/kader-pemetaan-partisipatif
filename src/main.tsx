import "./polyfills";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PenangkapErrorBoundary } from "./components/PenangkapErrorBoundary";
import { siapkanAutentikasi } from "./lib/auth";
import { siapkanStorage } from "./lib/storage";
import { pasangPendengarInstal } from "./lib/instal";
import { daftarkanAutoUpdatePwa } from "./lib/pwaUpdate";
import { pasangPolyfillPdfJs } from "./lib/geoPdf";
import "./styles/app.css";
import "./styles/petaAvenza.css";

// Tangkap event pemasangan PWA sedini mungkin dan aktifkan auto-update setiap kali republish
pasangPolyfillPdfJs();
pasangPendengarInstal();
daftarkanAutoUpdatePwa();

// Migrasi akun lama (sandi teks polos -> hash) dan pemuatan data dari IndexedDB selesai
// sebelum aplikasi membaca sesi dan data
Promise.all([siapkanAutentikasi().catch(() => undefined), siapkanStorage().catch(() => undefined)]).finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <PenangkapErrorBoundary>
        <App />
      </PenangkapErrorBoundary>
    </React.StrictMode>
  );
});
