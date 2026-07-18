# Devlog — Adaptive Typing Trainer

Catatan proses bangun & dogfooding project ini. Ditulis apa adanya —
termasuk keraguan, ide yang ditolak sendiri, dan bug yang ditemukan
lewat pemakaian nyata, bukan cuma yang berhasil.

Lihat [mini-PRD](./mini-prd-typing-trainer.md) untuk konteks problem
statement, goal, dan scope MVP.

---

## Day 1

Terkadang, walau user sudah menguasai pengetikan kata/suku kata
tertentu, user masih bisa salah mengetiknya dikarenakan
faktor-faktor/variabel lain yang memengaruhi kesalahan mengetik
selain karena kesulitan pengetikan kata, seperti fokus user, dll —
yang mana itu seharusnya tidak dikategorikan sebagai error. Atau
sebaiknya kesalahan itu dibagi menjadi beberapa kategori? *Let's play
it by ear.*

**Status:** Belum ditindaklanjuti — masih dipantau apakah pola ini
tetap muncul setelah perbaikan word-boundary & akurasi char-level di
bawah.

## Day 2

Gimana kalau modenya hanya 1 saja. Tapi setelah 1 sesi selesai, sesi
selanjutnya akan mengandung kata-kata yang salah untuk diperbaiki.
Jika tidak berhasil diperbaiki, kata akan tetap muncul di sesi
berikutnya. Jika diperbaiki, akan muncul secara acak saja tanpa
disengaja. Tapi menurutku ini tidak terlalu bijak — butuh solusi
yang lebih baik.

**Status:** Ditolak sendiri, belum ada solusi pengganti. Nyambung ke
diskusi 14/7.

## Day 3

- Perhitungan akurasi tidak menghitung error yang diperbaiki — kalau
  ada yang salah tapi dibetulkan, akurasi tidak berkurang.
  **→ Diperbaiki.**
- Pengalaman mengetik kurang seperti Monkeytype: saat mengetik
  `"orr"` untuk target `"or "`, user malah lanjut ke kata berikutnya
  tanpa validasi. Kata yang sudah benar seharusnya tidak bisa dihapus
  lagi.
  **→ Diperbaiki** lewat refactor model input dari satu string
  panjang menjadi state machine per-kata (commit per spasi, kata
  salah bisa dibuka ulang via backspace, kata benar terkunci).

## 7 Juli 2026

Tampilan test page dibuat mirip Monkeytype — tab kurang menarik,
tambah ikon, ganti dari textfield polos.

**Status:** Belum dikerjakan — sengaja ditunda, konsisten dengan
non-scope di mini-PRD (branding/polish setelah dogfooding).

## 8 Juli 2026

- Fitur quick reset ala Monkeytype (tombol Tab).
  **→ Diperbaiki**, digabung sekalian pas refactor word-boundary.
- Dashboard kurang informatif — ingin coba TanStack Query.
  **Status:** Belum dikerjakan.
- Bug: grafik dashboard grouping berdasarkan tanggal, tooltip cuma
  nampilin test pertama kalau ada beberapa sesi di tanggal yang sama.
  **→ Diperbaiki** (sumbu X pakai index sesi + tooltip custom
  nampilin tanggal-jam lengkap).
- Dashboard reload ulang tiap pindah tab browser lalu balik lagi.
  **→ Diperbaiki** (dependency `useEffect` diganti ke `user.id` saja,
  bukan seluruh object session yang berubah referensinya tiap auth
  listener fire).

## 14 Juli 2026

Sadar kurang riset soal solusi aplikasi ini sebelum bangun. Mulai
meragukan efektivitas Weak-Point Drill. Kepikiran solusi lain:
gamifikasi kata salah — sebelum lanjut ke test berikutnya, user harus
mengetik ulang kata yang salah sampai benar dulu.

**Status:** Riset singkat dilakukan — spaced/distributed practice dan
immediate error correction sama-sama didukung literatur skill
acquisition, dan idenya sejalan dengan yang sudah diimplementasi
tool lain (keybr.com untuk huruf, prinsip serupa untuk kata). Belum
ada studi yang langsung membandingkan "drill kata lemah" vs "practice
teks natural" untuk typing speed secara spesifik — jadi data
dogfooding sendiri tetap jadi sumber jawaban utama untuk kasus ini.
Keputusan lanjut/pause masih dipikirkan.