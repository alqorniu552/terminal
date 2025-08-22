
# Panduan Instalasi untuk Ubuntu 22.04

Dokumen ini memberikan langkah-langkah terperinci untuk menyiapkan dan menjalankan aplikasi Command Center pada sistem Ubuntu 22.04.

## Prasyarat

Sebelum memulai, pastikan Anda memiliki akses ke terminal dan hak sudo.

### 1. Perbarui Sistem Anda

Selalu merupakan praktik yang baik untuk memastikan daftar paket Anda mutakhir.

```bash
sudo apt update
sudo apt upgrade
```

### 2. Instal Node.js menggunakan NVM (Node Version Manager)

Menggunakan NVM adalah cara yang direkomendasikan untuk menginstal Node.js dan npm. Ini memungkinkan Anda untuk dengan mudah beralih di antara beberapa versi Node.js.

- **Instal dependensi yang diperlukan:**
  ```bash
  sudo apt install curl build-essential
  ```

- **Instal NVM:**
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  ```

- **Muat NVM ke sesi shell Anda saat ini:**
  ```bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
  ```
  Anda mungkin perlu menutup dan membuka kembali terminal Anda agar perubahan ini berlaku.

- **Instal versi LTS (Long-Term Support) dari Node.js:**
  ```bash
  nvm install --lts
  ```

- **Verifikasi instalasi:**
  ```bash
  node -v
  npm -v
  ```
  Anda akan melihat versi Node.js (misalnya, v20.x.x) dan npm.

### 3. Instal Git

Jika Anda belum menginstal Git, instal sekarang.

```bash
sudo apt install git
```

## Penyiapan Aplikasi

### 1. Kloning Repositori

Kloning kode sumber proyek ke mesin lokal Anda.

```bash
git clone https://github.com/firebase/studio-command-center.git
cd studio-command-center
```

### 2. Instal Dependensi Proyek

Gunakan npm untuk menginstal semua paket yang diperlukan yang tercantum dalam `package.json`.

```bash
npm install
```

### 3. Konfigurasi Variabel Lingkungan

Aplikasi ini memerlukan kunci API untuk beberapa fitur AI-nya.

- **Buat file `.env`:**
  Buat salinan `firebase.ts` untuk `apiKey`, lalu buat file `.env` untuk `GEMINI_API_KEY`
  
- **Dapatkan Kunci API Gemini Anda:**
  1.  Buka [Google AI Studio](https://aistudio.google.com/).
  2.  Masuk dengan akun Google Anda.
  3.  Klik tombol "**Get API key**".
  4.  Buat kunci API di proyek Google Cloud yang baru atau yang sudah ada.

- **Tambahkan kunci ke file `.env` Anda:**
  Buka file `.env` dan tambahkan kunci API Anda seperti ini:

  ```
  GEMINI_API_KEY=KUNCI_API_ANDA_DI_SINI
  ```
  **Catatan:** File `firebase.ts` sudah berisi konfigurasi publik yang diperlukan. Anda tidak perlu memodifikasinya.

## Menjalankan Aplikasi

Aplikasi ini memerlukan dua proses terminal yang berjalan secara bersamaan: satu untuk server web Next.js dan satu lagi untuk backend Genkit AI.

### 1. Mulai Server Web Next.js

Buka terminal di direktori proyek dan jalankan:

```bash
npm run dev
```

Server pengembangan akan dimulai, biasanya pada port 9002. Anda dapat mengakses aplikasi di `http://localhost:9002`.

### 2. Mulai Backend Genkit AI

Buka terminal **kedua** di direktori proyek dan jalankan:

```bash
npm run genkit:watch
```

Perintah ini memulai layanan Genkit dan akan memuat ulang secara otomatis setiap kali Anda membuat perubahan pada file *flow* AI.

**Anda sekarang siap!** Buka browser Anda ke `http://localhost:9002` untuk mulai menggunakan Command Center.

## Menjalankan di Latar Belakang (Opsional)

Jika Anda perlu menjalankan server pengembangan untuk waktu yang lama dan ingin server tetap berjalan bahkan setelah Anda menutup terminal, Anda dapat menggunakan `nohup` (no hang up).

### 1. Mulai Server di Latar Belakang

- **Untuk server Next.js:**
  ```bash
  nohup npm run dev > next-dev.log 2>&1 &
  ```

- **Untuk backend Genkit AI:**
  ```bash
  nohup npm run genkit:watch > genkit-watch.log 2>&1 &
  ```

Perintah-perintah ini akan:
- `nohup`: Membuat perintah kebal terhadap sinyal hangup.
- `> ...log`: Mengalihkan output standar ke file log.
- `2>&1`: Mengalihkan kesalahan standar ke file log yang sama.
- `&`: Menjalankan perintah di latar belakang.

Anda akan melihat ID proses (PID) dari setiap perintah. Catat PID ini jika Anda perlu menghentikan proses nanti.

### 2. Memeriksa Log

Anda dapat memantau output server dengan melihat file log:

```bash
tail -f next-dev.log
tail -f genkit-watch.log
```
Gunakan `Ctrl+C` untuk berhenti melihat log.

### 3. Menghentikan Server Latar Belakang

Untuk menghentikan server, Anda perlu menggunakan PID yang Anda catat sebelumnya. Jika Anda tidak memilikinya, Anda dapat menemukannya:

```bash
# Temukan PID untuk proses Node.js yang berjalan di port 9002 (Next.js)
ps aux | grep '9002'

# Temukan PID untuk proses Genkit
ps aux | grep 'genkit:watch'
```

Setelah Anda memiliki PID, gunakan perintah `kill`:

```bash
kill PID_ANDA_DI_SINI
```
Misalnya, `kill 12345`.
