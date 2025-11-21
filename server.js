const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fetch = require("node-fetch");
const mongoose = require('mongoose'); 

// Baris 9: Buat aplikasi Express Anda
const app = express();

// Baris 10: Buat server HTTP dan berikan 'app' sebagai request handler
const server = http.createServer(app); 

// Baris 11: Tempelkan Socket.io ke server HTTP yang sudah jadi
const io = new Server(server);

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// ==========================================================
// == KONEKSI DATABASE ==
// ==========================================================
const DB_URL = "mongodb+srv://SIPADAM_db_user:gibranpermadi@cluster0.mufnsjc.mongodb.net/sipadam?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(DB_URL)
  .then(() => console.log('✅ Berhasil terhubung ke MongoDB Atlas'))
  .catch((err) => console.error('❌ Gagal terhubung ke MongoDB:', err.message));

// ==========================================================
// == SKEMA DATABASE (DIPERBARUI) ==
// ==========================================================
const LaporanSchema = new mongoose.Schema({
  lokasi: String,
  catatan: String,
  waktu: String,
  status: { type: String, default: 'Aktif' },
  image: String,
  
  // ===== TAMBAHAN BARU =====
  tipeLaporan: { type: String, default: 'Warga' }, // 'Warga' atau 'Sensor'
  suhu: String,
  kelembaban: String, 
  intensitas: String
  // =========================
});

const Laporan = mongoose.model('Laporan', LaporanSchema);


// --- PENGATURAN HALAMAN STATIS ---
app.use(express.static(path.join(__dirname, "public")));
app.use("/admin", express.static(path.join(__dirname, "admin")));

// --- RUTE HALAMAN ADMIN ---
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin/login.html"));
});
app.get("/admin/login", (req, res) => {
  res.sendFile(path.join(__dirname, "admin/login.html"));
});
app.get("/admin/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "admin/dashboard.html"));
});
app.get("/admin/laporan", (req, res) => {
  res.sendFile(path.join(__dirname, "admin/laporan.html"));
});
app.get("/admin/statistik", (req, res) => {
  res.sendFile(path.join(__dirname, "admin/statistik.html"));
});
app.get("/admin/detail-laporan", (req, res) => {
  res.sendFile(path.join(__dirname, "admin/detail-laporan.html"));
});
app.get("/admin/profil", (req, res) => {
  res.sendFile(path.join(__dirname, "admin/profil.html"));
});

// ==========================================================
// == API DATA LAPORAN ==
// ==========================================================

// 1. API UNTUK MENGAMBIL SEMUA LAPORAN
app.get('/api/laporan', async (req, res) => {
  try {
    const semuaLaporan = await Laporan.find().sort({_id: -1}); 
    res.json(semuaLaporan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. API UNTUK MENGAMBIL SATU LAPORAN SPESIFIK
app.get('/api/laporan/:id', async (req, res) => {
  try {
    const laporan = await Laporan.findById(req.params.id);
    if (laporan == null) {
      return res.status(404).json({ message: 'Laporan tidak ditemukan' });
    }
    res.json(laporan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. API UNTUK MENGUBAH STATUS LAPORAN
app.patch('/api/laporan/:id/status', async (req, res) => {
  try {
    const { status } = req.body; 
    const laporanId = req.params.id;

    if (!status) {
      return res.status(400).json({ message: 'Status tidak boleh kosong' });
    }

    const laporanDiperbarui = await Laporan.findByIdAndUpdate(
      laporanId,
      { status: status },
      { new: true } 
    );

    if (!laporanDiperbarui) {
      return res.status(404).json({ message: 'Laporan tidak ditemukan' });
    }

    io.to('ruangan-admin').emit('laporan-diperbarui', laporanDiperbarui);
    console.log(`Status laporan ${laporanId} diubah menjadi: ${status}`);

    res.json(laporanDiperbarui);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Rute untuk Halaman User
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// --- Server & Jembatan IoT ---
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server SIPADAM berjalan di http://localhost:${PORT}`);
  console.log(`Halaman Admin bisa diakses di http://localhost:${PORT}/admin`);
});

const ESP32_IP_ADDRESS = "http://192.168.10.96"; 
async function ambilDataSensor() {
  try {
    const response = await fetch(`${ESP32_IP_ADDRESS}/api/data`); 
    if (!response.ok) throw new Error("ESP32 Gagal Fetch");
    
    const dataSensor = await response.json();
    io.emit("data-sensor", dataSensor); // Kirim ke dashboard user

    // ==========================================================
    // ===== LOGIKA BARU: BUAT LAPORAN OTOMATIS JIKA BAHAYA =====
    // ==========================================================
    
    // Sesuaikan kondisi 'HIGH_RISK' atau 'smokeAlarm' ini
    if (dataSensor.riskLevel === 'HIGH_RISK' || dataSensor.smokeAlarm === true) {
      
      console.log('SENSOR BAHAYA: Membuat laporan otomatis...');
      
      const laporanSensor = new Laporan({
        lokasi: dataSensor.location || '-6.9820, 110.4153', // Ganti dengan lokasi sensor Anda
        catatan: 'Laporan otomatis dari Sensor: ' + (dataSensor.sensorName || 'Sensor Utama'), 
        waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        status: 'Aktif',
        image: null,
        tipeLaporan: 'Sensor', // Tipe baru
        suhu: dataSensor.temperature ? dataSensor.temperature + '°C' : '--°C',
        kelembaban: dataSensor.humidity ? dataSensor.humidity + '%' : '--%', 
        intensitas: dataSensor.smoke_ppm ? dataSensor.smoke_ppm + ' ppm' : '--'
      });

      // Simpan laporan otomatis ini ke MongoDB
      const laporanTersimpan = await laporanSensor.save();

      // Siarkan laporan BARU ini ke ADMIN (agar dashboard admin ter-update)
      io.to('ruangan-admin').emit('laporan-masuk', laporanTersimpan);
    }
    // ==========================================================
    // ===== BATAS LOGIKA BARU =====
    // ==========================================================

  } catch (error) {
    console.error("Gagal terhubung ke ESP32:", error.message);
    io.emit("data-error", { message: "ESP32 tidak terhubung." });
  }
}
setInterval(ambilDataSensor, 2000);

// ==========================================================
// == OTAK "Socket.io" ==
// ==========================================================
io.on("connection", (socket) => {
  console.log("Sebuah browser telah terhubung (ID:", socket.id, ")");

  // 1. DENGARKAN JIKA ADA ADMIN YANG BERGABUNG
  socket.on('admin-bergabung', async () => { 
    socket.join('ruangan-admin');
    console.log(`Socket ${socket.id} (ADMIN) telah bergabung ke ruangan.`);

    try {
      const laporanLama = await Laporan.find().sort({_id: -1}).limit(10);
      socket.emit('muat-laporan-lama', laporanLama); 
    } catch (err) {
      console.error('Gagal memuat laporan lama:', err);
    }
  });
  
  // 2. DENGARKAN JIKA ADA LAPORAN BARU DARI USER
  socket.on('laporan-baru', async (dataLaporan) => { 
    console.log(`LAPORAN BARU DITERIMA dari Socket ${socket.id} (USER):`, dataLaporan);

    try {
      const laporanBaru = new Laporan({
        lokasi: dataLaporan.lokasi,
        catatan: dataLaporan.catatan,
        waktu: dataLaporan.waktu,
        image: dataLaporan.image,
        tipeLaporan: 'Warga', // Laporan dari sini selalu 'Warga'
        // ===== SIMPAN DATA SENSOR BARU =====
        suhu: dataLaporan.suhu,
        kelembaban: dataLaporan.kelembaban,
        intensitas: dataLaporan.intensitas
        // ===================================
      });
      
      const laporanTersimpan = await laporanBaru.save(); 

      io.to('ruangan-admin').emit('laporan-masuk', laporanTersimpan); 
      console.log('Laporan baru (Warga) disiarkan ke ruangan-admin.');
      
    } catch (err) {
      console.error('Gagal menyimpan laporan baru:', err);
    }
  });
  
  socket.on("disconnect", () => {
    console.log(`Socket ${socket.id} terputus`);
  });
});