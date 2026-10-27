/// <reference types="vite/client" />

/**
 * Deklarasi tipe environment Vite (import.meta.env, HMR API, aset statis).
 *
 * Sengaja diletakkan di sini, bukan lewat `compilerOptions.types` di
 * tsconfig.json. Direktif reference menyelesaikan paket lewat resolusi modul
 * sehingga tetap ditemukan di mesin build (Vercel), sedangkan entri
 * `types: ["vite/client"]` dibaca sebagai nama type library di folder
 * node_modules/@types dan memicu error TS2688.
 */
