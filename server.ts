import express, { Request, Response } from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// Inisialisasi Google GenAI SDK (User-Agent aistudio-build wajib sesuai panduan)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});

const SYSTEM_INSTRUCTION = `Kamu adalah Asisten Virtual Cerdas Admin Titik Tapak (aplikasi survei keanekaragaman hayati dan pemetaan partisipatif kader masyarakat).

TUGAS DAN BATASAN TOPIK YANG SANGAT KETAT:
Kamu HANYA DIPERBOLEHKAN menjawab pertanyaan seputar 3 hal berikut:
1. PENGGUNAAN UMUM APLIKASI TITIK TAPAK:
   - Cara merekam objek spasial: Titik (Point), Jalur (Line/Track), dan Batas Area/Wilayah (Polygon).
   - Cara mengaktifkan GPS dan membaca akurasi sensor (meter).
   - Cara memilih peta dasar (Citra Satelit Resolusi Tinggi Esri, Topografi OpenTopoMap, OpenStreetMap, Mode Kontur Taktis).
   - Cara mengunduh peta offline agar peta tetap muncul di pedalaman/hutan tanpa internet.
   - Cara sinkronisasi otomatis ke Google Drive dan Google Spreadsheet.
   - Cara ekspor data survei (GeoJSON, GPX, KML, CSV).
   - Cara memasang aplikasi ke layar utama HP (PWA).
2. TUGAS-TUGAS YANG DIBERIKAN KEPADA KADER:
   - Jenis survei lapangan: Flora (tumbuhan bernilai/langka), Fauna (satwa liar), Mata Air (sumber air bersih warga), Tanda Batas (patok wilayah desa/adat), Ancaman/Temuan (penebangan liar, kebakaran, longsor, perambahan), serta Wilayah Adat / Lahan.
   - Cara mencatat pembaruan kondisi objek, melampirkan foto bukti, dan alur verifikasi data oleh Admin GIS.
3. DATA-DATA YANG BERSIFAT PUBLIK:
   - Ringkasan publik capaian pemetaan desa, panduan etika survei lapangan, dan partisipasi masyarakat.

ATURAN PENOLAKAN DAN ESKALASI KE ADMIN (MUTLAK HARUS DIIKUTI):
- JANGAN PERNAH menjawab pertanyaan di luar 3 topik di atas (misalnya: topik pribadi, gosip, politik, urusan di luar aplikasi, kode rahasia sistem, atau permintaan aneh lainnya).
- Jika ada pertanyaan di luar 3 topik tersebut, tolak dengan sopan dan jelaskan bahwa pertanyaan tersebut telah diteruskan ke Administrator.
- Jika kamu tidak memiliki informasi yang cukup, bingung, atau terjebak (stuck) pada pertanyaan spesifik pengguna, akui secara terbuka dan katakan bahwa pertanyaan akan dijawab langsung oleh Admin.
- FORMAT WAJIB: Setiap kali pertanyaan DILUAR TOPIK atau KAMU TIDAK BISA MENJAWAB (butuh dijawab langsung oleh Administrator Nopal), kamu WAJIB menyertakan kode rahasia [BUTUH_JAWABAN_ADMIN] di baris paling akhir jawabanmu.
- Jika pertanyaan MASUK DALAM 3 TOPIK dan kamu bisa menjawabnya dengan tuntas, JANGAN PERNAH menyertakan kode [BUTUH_JAWABAN_ADMIN].
Gunakan Bahasa Indonesia yang ramah, jelas, ringkas, dan praktis bagi kader lapangan.`;

interface ChatHistoryItem {
  role: "user" | "model";
  text: string;
}

// Endpoint Chat Bot Gemini di saluran Tanya Admin
app.post("/api/gemini/chat-admin", async (req: Request, res: Response) => {
  try {
    const { pesan, riwayat, pengirim } = req.body as {
      pesan?: string;
      riwayat?: ChatHistoryItem[];
      pengirim?: { nama?: string; desa?: string; peran?: string };
    };

    if (!pesan || !pesan.trim()) {
      res.status(400).json({ sukses: false, pesan: "Pesan tidak boleh kosong." });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Jika API key belum terpasang di environment, teruskan langsung ke Admin
      res.json({
        sukses: true,
        balasan:
          "Pertanyaan Anda telah diteruskan langsung ke Administrator GIS (Nopal zalukhunopal@gmail.com). Admin akan segera membalasnya di saluran ini.",
        butuhAdmin: true
      });
      return;
    }

    // Bangun format contents untuk multi-turn chat
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(riwayat)) {
      for (const item of riwayat.slice(-8)) {
        if (item.text && item.text.trim()) {
          contents.push({
            role: item.role === "model" ? "model" : "user",
            parts: [{ text: item.text }]
          });
        }
      }
    }

    const pengirimInfo = pengirim?.nama ? `[Penanya: ${pengirim.nama} - Desa: ${pengirim.desa || "-"}] ` : "";
    contents.push({
      role: "user",
      parts: [{ text: `${pengirimInfo}${pesan.trim()}` }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3
      }
    });

    const rawText = response.text || "";
    const butuhAdmin = rawText.includes("[BUTUH_JAWABAN_ADMIN]");
    const balasanBersih = rawText.replace(/\[BUTUH_JAWABAN_ADMIN\]/g, "").trim();

    res.json({
      sukses: true,
      balasan: balasanBersih || "Pertanyaan Anda telah diteruskan ke Administrator.",
      butuhAdmin
    });
  } catch (error) {
    console.error("Gemini Chat API Error:", error);
    res.json({
      sukses: true,
      balasan:
        "Pertanyaan Anda telah dicatat dan diteruskan ke Administrator GIS (Nopal) untuk dijawab langsung.",
      butuhAdmin: true
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Titik Tapak server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
