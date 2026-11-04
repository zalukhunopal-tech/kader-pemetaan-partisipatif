/**
 * Polyfill ES2024 / ES2025 / ES2026 untuk lingkungan WebView Android, Chrome Mobile,
 * PWA seluler terinstal, Safari iOS, dan Web Worker.
 *
 * Diperlukan terutama oleh pdfjs-dist v5/v6:
 * - Map.prototype.getOrInsertComputed & getOrInsert
 * - WeakMap.prototype.getOrInsertComputed & getOrInsert
 * - Promise.withResolvers & Promise.try
 * - URL.parse
 * - Math.sumPrecise
 * - Uint8Array.prototype.toHex
 */

export function terapkanPolyfills(): void {
  // 1. Map.prototype.getOrInsertComputed & getOrInsert
  if (typeof Map !== "undefined") {
    const mapProto = Map.prototype as unknown as {
      getOrInsertComputed?: <K, V>(this: Map<K, V>, key: K, callbackfn: (key: K) => V) => V;
      getOrInsert?: <K, V>(this: Map<K, V>, key: K, defaultValue: V) => V;
    };
    if (typeof mapProto.getOrInsertComputed !== "function") {
      Object.defineProperty(Map.prototype, "getOrInsertComputed", {
        value: function getOrInsertComputed<K, V>(this: Map<K, V>, key: K, callbackfn: (key: K) => V): V {
          if (typeof callbackfn !== "function") {
            throw new TypeError("Callback harus berupa fungsi.");
          }
          const k = Object.is(key, -0) ? (+0 as unknown as K) : key;
          if (this.has(k)) return this.get(k) as V;
          const val = callbackfn(k);
          this.set(k, val);
          return val;
        },
        configurable: true,
        writable: true
      });
    }
    if (typeof mapProto.getOrInsert !== "function") {
      Object.defineProperty(Map.prototype, "getOrInsert", {
        value: function getOrInsert<K, V>(this: Map<K, V>, key: K, defaultValue: V): V {
          const k = Object.is(key, -0) ? (+0 as unknown as K) : key;
          if (this.has(k)) return this.get(k) as V;
          this.set(k, defaultValue);
          return defaultValue;
        },
        configurable: true,
        writable: true
      });
    }
  }

  // 2. WeakMap.prototype.getOrInsertComputed & getOrInsert
  if (typeof WeakMap !== "undefined") {
    const weakMapProto = WeakMap.prototype as unknown as {
      getOrInsertComputed?: <K extends object, V>(this: WeakMap<K, V>, key: K, callbackfn: (key: K) => V) => V;
      getOrInsert?: <K extends object, V>(this: WeakMap<K, V>, key: K, defaultValue: V) => V;
    };
    if (typeof weakMapProto.getOrInsertComputed !== "function") {
      Object.defineProperty(WeakMap.prototype, "getOrInsertComputed", {
        value: function getOrInsertComputed<K extends object, V>(this: WeakMap<K, V>, key: K, callbackfn: (key: K) => V): V {
          if (typeof callbackfn !== "function") {
            throw new TypeError("Callback harus berupa fungsi.");
          }
          if (this.has(key)) return this.get(key) as V;
          const val = callbackfn(key);
          this.set(key, val);
          return val;
        },
        configurable: true,
        writable: true
      });
    }
    if (typeof weakMapProto.getOrInsert !== "function") {
      Object.defineProperty(WeakMap.prototype, "getOrInsert", {
        value: function getOrInsert<K extends object, V>(this: WeakMap<K, V>, key: K, defaultValue: V): V {
          if (this.has(key)) return this.get(key) as V;
          this.set(key, defaultValue);
          return defaultValue;
        },
        configurable: true,
        writable: true
      });
    }
  }

  // 3. Promise.withResolvers & Promise.try
  if (typeof Promise !== "undefined") {
    const promiseStatic = Promise as unknown as {
      withResolvers?: <T>() => {
        promise: Promise<T>;
        resolve: (value: T | PromiseLike<T>) => void;
        reject: (reason?: unknown) => void;
      };
      try?: <T>(fn: (...args: unknown[]) => T | PromiseLike<T>, ...args: unknown[]) => Promise<T>;
    };
    if (typeof promiseStatic.withResolvers !== "function") {
      Object.defineProperty(Promise, "withResolvers", {
        value: function withResolvers<T>() {
          let resolve!: (value: T | PromiseLike<T>) => void;
          let reject!: (reason?: unknown) => void;
          const promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
          });
          return { promise, resolve, reject };
        },
        configurable: true,
        writable: true
      });
    }
    if (typeof promiseStatic.try !== "function") {
      Object.defineProperty(Promise, "try", {
        value: function promiseTry<T>(fn: (...args: unknown[]) => T | PromiseLike<T>, ...args: unknown[]): Promise<T> {
          return new Promise<T>((resolve) => {
            resolve(fn(...args));
          });
        },
        configurable: true,
        writable: true
      });
    }
  }

  // 4. URL.parse
  if (typeof URL !== "undefined") {
    const urlStatic = URL as unknown as {
      parse?: (url: string, base?: string) => URL | null;
    };
    if (typeof urlStatic.parse !== "function") {
      Object.defineProperty(URL, "parse", {
        value: function parse(url: string, base?: string): URL | null {
          try {
            return base !== undefined ? new URL(url, base) : new URL(url);
          } catch {
            return null;
          }
        },
        configurable: true,
        writable: true
      });
    }
  }

  // 5. Math.sumPrecise
  const mathStatic = Math as unknown as {
    sumPrecise?: (items: Iterable<number>) => number;
  };
  if (typeof mathStatic.sumPrecise !== "function") {
    Object.defineProperty(Math, "sumPrecise", {
      value: function sumPrecise(items: Iterable<number>): number {
        let sum = 0;
        for (const n of items) sum += Number(n);
        return sum;
      },
      configurable: true,
      writable: true
    });
  }

  // 6. Uint8Array.prototype.toHex
  if (typeof Uint8Array !== "undefined") {
    const u8Proto = Uint8Array.prototype as unknown as {
      toHex?: (this: Uint8Array) => string;
    };
    if (typeof u8Proto.toHex !== "function") {
      Object.defineProperty(Uint8Array.prototype, "toHex", {
        value: function toHex(this: Uint8Array): string {
          let out = "";
          for (let i = 0; i < this.length; i++) {
            out += this[i].toString(16).padStart(2, "0");
          }
          return out;
        },
        configurable: true,
        writable: true
      });
    }
  }

  // 7. Interseptor Web Worker & Blob agar thread worker selalu mewarisi polyfill
  const win = (typeof window !== "undefined" ? window : globalThis) as unknown as {
    __agyWorkerPatched?: boolean;
    Blob?: typeof Blob;
    Worker?: typeof Worker;
    location?: Location;
  };

  if (win && !win.__agyWorkerPatched && typeof win.Worker === "function" && typeof win.Blob === "function") {
    win.__agyWorkerPatched = true;
    const kodeWorker = `/* __agyPdfPolyfill */(${terapkanPolyfills.toString()})();\n`;
    const OrigBlob = win.Blob;
    const PatchedBlob = function Blob(blobParts?: BlobPart[], options?: BlobPropertyBag) {
      if (Array.isArray(blobParts) && blobParts.length > 0) {
        const adaImport = blobParts.some(
          (p) => typeof p === "string" && p.includes("import(") && !p.includes("__agyPdfPolyfill")
        );
        if (adaImport) {
          blobParts = [kodeWorker, ...blobParts];
        }
      }
      return options !== undefined ? new OrigBlob(blobParts, options) : new OrigBlob(blobParts);
    } as unknown as typeof Blob;
    PatchedBlob.prototype = OrigBlob.prototype;
    Object.setPrototypeOf(PatchedBlob, OrigBlob);
    win.Blob = PatchedBlob;

    const OrigWorker = win.Worker;
    const PatchedWorker = function Worker(scriptURL: string | URL, options?: WorkerOptions) {
      const urlStr = String(scriptURL || "");
      if (
        urlStr &&
        !urlStr.startsWith("blob:") &&
        !urlStr.startsWith("data:") &&
        (options?.type === "module" || urlStr.includes("pdf"))
      ) {
        try {
          const baseHref = win.location?.href || "http://localhost/";
          const fullUrl = new URL(urlStr, baseHref).href;
          const blob = new OrigBlob([`${kodeWorker}await import(${JSON.stringify(fullUrl)});\n`], {
            type: "text/javascript"
          });
          return new OrigWorker(URL.createObjectURL(blob), { ...(options || {}), type: "module" });
        } catch {
          // Lanjutkan ke worker asli jika pembuatan blob URL gagal
        }
      }
      return options !== undefined ? new OrigWorker(scriptURL, options) : new OrigWorker(scriptURL);
    } as unknown as typeof Worker;
    PatchedWorker.prototype = OrigWorker.prototype;
    Object.setPrototypeOf(PatchedWorker, OrigWorker);
    win.Worker = PatchedWorker;
  }
}

// Jalankan segera saat modul diimpor
terapkanPolyfills();
