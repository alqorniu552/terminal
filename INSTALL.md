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

Aplikasi ini memerlukan kunci API dan konfigurasi Firebase.

- **Buat file `.env` Anda:**
  Salin file templat `.env.example` ke file baru bernama `.env`. File ini akan berisi kunci rahasia Anda dan tidak boleh dibagikan.
  ```bash
  cp .env.example .env
  ```
  
- **Isi Variabel Lingkungan:**
  Buka file `.env` yang baru Anda buat dengan editor teks. Anda perlu mengisi nilai-nilai berikut:

  1.  **`GEMINI_API_KEY`**:
      *   Buka [Google AI Studio](https://aistudio.google.com/).
      *   Klik tombol "**Get API key**" dan buat kunci API baru.
      *   Salin kunci tersebut ke dalam file `.env`.

  2.  **Konfigurasi Firebase (`NEXT_PUBLIC_FIREBASE_*`)**:
      *   Buka [Konsol Firebase](https://console.firebase.google.com/) dan pilih proyek Anda.
      *   Klik ikon roda gigi (Pengaturan) di pojok kiri atas dan pilih **Project settings**.
      *   Di tab **General**, gulir ke bawah ke bagian **Your apps**.
      *   Pilih aplikasi web Anda atau buat yang baru.
      *   Di bagian **Firebase SDK snippet**, pilih **Config**.
      *   Anda akan melihat objek konfigurasi JavaScript. Salin nilai-nilai yang sesuai (apiKey, authDomain, projectId, dll.) ke variabel yang cocok di file `.env` Anda.

  File `.env` Anda akan terlihat seperti ini setelah diisi:
  ```
  GEMINI_API_KEY="KUNCI_API_GEMINI_ANDA"

  NEXT_PUBLIC_FIREBASE_API_KEY="AIza..."
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="proyek-anda.firebaseapp.com"
  NEXT_PUBLIC_FIREBASE_PROJECT_ID="proyek-anda"
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="proyek-anda.appspot.com"
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1234567890"
  NEXT_PUBLIC_FIREBASE_APP_ID="1:1234567890:web:abcdef123456"
  ```

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

## Menjalankan di Latar Belakang dengan PM2 (Direkomendasikan)

Untuk menjalankan aplikasi secara terus-menerus di latar belakang, sangat disarankan untuk menggunakan **PM2**, manajer proses tingkat produksi untuk aplikasi Node.js.

### 1. Instal PM2

Instal PM2 secara global menggunakan npm.

```bash
npm install pm2 -g
```

### 2. Mulai Aplikasi dengan PM2

Gunakan PM2 untuk memulai dan memberi nama pada setiap proses. Ini memungkinkan Anda untuk mengelolanya dengan mudah nanti.

- **Mulai server Next.js:**
  ```bash
  pm2 start npm --name "command-center-web" -- run dev
  ```

- **Mulai backend Genkit AI:**
  ```bash
  pm2 start npm --name "command-center-genkit" -- run genkit:watch
  ```

### 3. Mengelola Proses dengan PM2

Berikut adalah beberapa perintah PM2 yang berguna:

- **Melihat status semua proses:**
  ```bash
  pm2 list
  ```

- **Memantau log dari proses tertentu:**
  ```bash
  # Tampilkan log untuk server web
  pm2 logs command-center-web

  # Tampilkan log untuk backend Genkit
  pm2 logs command-center-genkit
  ```

- **Menghentikan proses:**
  ```bash
  pm2 stop command-center-web
  ```

- **Memulai ulang proses:**
  ```bash
  pm2 restart command-center-web
  ```

- **Menghapus proses dari daftar PM2:**
  ```bash
  pm2 delete command-center-web
  ```

## Menjalankan di Latar Belakang (Alternatif dengan `nohup`)

Jika Anda tidak ingin menggunakan PM2, Anda dapat menggunakan `nohup` (no hang up) bawaan Linux.

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
