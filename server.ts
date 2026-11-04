import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

function parseArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return undefined;
}

const cliPort = parseArg("--port");
const PORT = cliPort ? Number(cliPort) : (Number(process.env.PORT) || 3000);
const cliHost = parseArg("--host");
const HOST = cliHost || process.env.HOST || "0.0.0.0";

// Nonaktifkan header identifikasi server demi keamanan
app.disable("x-powered-by");

// Header Keamanan Dasar
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Pengecekan ada tidaknya karakter kontrol ASCII (0-8, 11-12, 14-31)
function hasUnsafeControlChars(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
      return true;
    }
  }
  return false;
}

// Sanitizer string aman dari karakter injeksi/kontrol
function sanitizeInput(str: unknown, maxLength = 2000): string {
  if (typeof str !== "string") return "";
  let clean = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
      continue;
    }
    clean += str[i];
  }
  return clean.trim().slice(0, maxLength);
}

// Middleware Validasi Path untuk Mencegah Path Traversal & Path Injection
app.use((req: Request, res: Response, next: NextFunction) => {
  const rawUrl = req.url || "";
  const requestPath = req.path || "";

  // 1. Validasi karakter Null Byte (%00 atau \0)
  if (rawUrl.includes("\0") || rawUrl.toLowerCase().includes("%00")) {
    res.status(400).json({ sukses: false, error: "Karakter tidak valid (null byte) terdeteksi." });
    return;
  }

  // 2. Decode URL dengan aman untuk pengecekan pola traversal terenkripsi
  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(rawUrl);
  } catch {
    res.status(400).json({ sukses: false, error: "URI request tidak valid." });
    return;
  }

  // 3. Deteksi pola Directory Traversal (.., ../, ..\)
  const traversalPattern = /(?:^|[\\/])\.\.(?:[\\/]|$)/;
  if (traversalPattern.test(rawUrl) || traversalPattern.test(decodedUrl) || traversalPattern.test(requestPath)) {
    res.status(403).json({ sukses: false, error: "Akses traversal path ditolak." });
    return;
  }

  // 4. Deteksi backslash injection di lingkungan path POSIX/Web
  if (rawUrl.includes("\\") || decodedUrl.includes("\\")) {
    res.status(400).json({ sukses: false, error: "Pemisah path backslash tidak diizinkan." });
    return;
  }

  // 5. Validasi query parameter untuk mencegah traversal atau injeksi karakter kontrol
  for (const [key, val] of Object.entries(req.query)) {
    const valString = typeof val === "string" ? val : Array.isArray(val) ? val.join(" ") : "";
    if (valString.includes("\0") || valString.includes("..") || hasUnsafeControlChars(valString)) {
      res.status(400).json({
        sukses: false,
        error: `Parameter query '${key}' mengandung karakter tidak valid.`
      });
      return;
    }
  }

  next();
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Handler kesalahan parsing JSON
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ sukses: false, error: "Payload JSON tidak valid." });
    return;
  }
  next(err);
});

// Inisialisasi Google GenAI SDK (User-Agent aistudio-build wajib sesuai panduan)
let cachedAi: GoogleGenAI | null = null;
function getAi(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cachedAi) {
    cachedAi = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return cachedAi;
}

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
  role?: "user" | "model";
  text?: string;
}

// ==========================================
// RUTE RESMI YANG DIIZINKAN
// ==========================================

// 1. Rute Chat Gemini ke Admin (Satu-satunya API route yang dibutuhkan aplikasi)
app.post("/api/gemini/chat-admin", async (req: Request, res: Response) => {
  try {
    const rawPesan = req.body?.pesan;
    if (typeof rawPesan !== "string" || !rawPesan.trim()) {
      res.status(400).json({ sukses: false, error: "Pesan tidak boleh kosong dan harus berupa teks." });
      return;
    }

    const pesan = sanitizeInput(rawPesan, 2000);
    if (!pesan) {
      res.status(400).json({ sukses: false, error: "Pesan tidak valid." });
      return;
    }

    const ai = getAi();
    if (!ai) {
      // Jika API key belum terpasang di environment, teruskan langsung ke Admin
      res.json({
        sukses: true,
        balasan:
          "Pertanyaan Anda telah diteruskan langsung ke Administrator GIS (Nopal zalukhunopal@gmail.com). Admin akan segera membalasnya di saluran ini.",
        butuhAdmin: true
      });
      return;
    }

    // Validasi dan sanitasi riwayat percakapan (maksimal 10 putaran terakhir)
    const rawRiwayat = req.body?.riwayat as ChatHistoryItem[] | undefined;
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(rawRiwayat)) {
      const riwayatAman = rawRiwayat.slice(-10);
      for (const item of riwayatAman) {
        if (item && typeof item === "object") {
          const role = item.role === "model" ? "model" : "user";
          const text = sanitizeInput(item.text, 2000);
          if (text) {
            contents.push({ role, parts: [{ text }] });
          }
        }
      }
    }

    // Sanitasi data profil pengirim
    const rawPengirim = req.body?.pengirim;
    let pengirimInfo = "";
    if (rawPengirim && typeof rawPengirim === "object") {
      const nama = sanitizeInput(rawPengirim.nama, 100);
      const desa = sanitizeInput(rawPengirim.desa, 100);
      if (nama) {
        pengirimInfo = `[Penanya: ${nama} - Desa: ${desa || "-"}] `;
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: `${pengirimInfo}${pesan}` }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
      balasan: balasanBersih || "Pertanyaan Anda telah dicatat dan diteruskan ke Administrator.",
      butuhAdmin
    });
  } catch (error) {
    console.error("Gemini Chat API Error:", error);
    res.json({
      sukses: true,
      balasan:
        "Pertanyaan Anda telah dicatat dan diteruskan ke Administrator GIS (Nopal zalukhunopal@gmail.com) untuk dijawab langsung.",
      butuhAdmin: true
    });
  }
});

// Menolak seluruh rute /api lain yang tidak terdaftar (tanpa menggunakan wildcard `*` agar aman di Express 5)
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({
    sukses: false,
    error: "Endpoint API tidak ditemukan atau tidak tersedia."
  });
});

// ==========================================
// SERVER STATIS & SPA SERVING
// ==========================================
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: HOST, port: PORT, hmr: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    const indexPath = path.resolve(distDir, "index.html");

    // Sajikan file statis terkompilasi dengan opsi pencegahan traversal
    app.use(
      express.static(distDir, {
        dotfiles: "ignore",
        index: false,
        fallthrough: true,
        maxAge: "1d",
        setHeaders(res, filePath) {
          const baseName = path.basename(filePath).toLowerCase();
          if (
            baseName === "sw.js" ||
            baseName === "registersw.js" ||
            baseName === "manifest.webmanifest" ||
            baseName === "index.html" ||
            baseName === "pdf.worker.min.mjs"
          ) {
            res.setHeader(
              "Cache-Control",
              "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
            );
          }
        }
      })
    );

    // Fallback rute untuk Single Page Application (SPA)
    app.use((req: Request, res: Response) => {
      // Hanya izinkan metode GET dan HEAD untuk penyajian SPA index
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.status(405).json({ sukses: false, error: "Metode HTTP tidak diizinkan." });
        return;
      }

      // Validasi ketat bahwa target file berada di dalam folder dist
      if (!indexPath.startsWith(distDir)) {
        res.status(403).json({ sukses: false, error: "Akses direktori terlarang." });
        return;
      }

      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
      );
      res.sendFile(indexPath);
    });
  }

  // Global Error Handler Terakhir (Express memerlukan 4 parameter untuk mendeteksi error handler)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Internal Server Error:", err);
    res.status(500).json({ sukses: false, error: "Terjadi kesalahan internal pada server." });
  });

  app.listen(PORT, HOST, () => {
    console.log(`Titik Tapak server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Gagal memulai server Titik Tapak:", err);
  process.exit(1);
});
