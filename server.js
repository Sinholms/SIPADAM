const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fetch = require("node-fetch");
const mongoose = require('mongoose'); 
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app); 
const io = new Server(server);

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// ==========================================================
// == PYTHON PROCESS MANAGEMENT ==
// ==========================================================
let pythonProcess = null;
let pythonReady = false;

function startPythonScript() {
  if (pythonProcess) {
    console.log('⚠️ Python script already running');
    return;
  }

  console.log('🐍 Starting Python fire detection script...');
  
  pythonProcess = spawn('python', ['test.py'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[PYTHON] ${output.trim()}`);
    
    if (output.includes('System ready')) {
      pythonReady = true;
      io.emit('python-status', { status: 'ready', message: 'Fire detection system ready' });
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[PYTHON ERROR] ${data.toString().trim()}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`🛑 Python process exited with code ${code}`);
    pythonProcess = null;
    pythonReady = false;
    io.emit('python-status', { status: 'stopped', message: 'Fire detection stopped' });
  });

  pythonProcess.on('error', (err) => {
    console.error('❌ Failed to start Python script:', err);
    pythonProcess = null;
    pythonReady = false;
    io.emit('python-status', { status: 'error', message: err.message });
  });
}

function stopPythonScript() {
  if (pythonProcess) {
    console.log('🛑 Stopping Python script...');
    pythonProcess.kill('SIGINT');
    pythonProcess = null;
    pythonReady = false;
  }
}

// Auto-start Python on server startup
startPythonScript();

// ==========================================================
// == DATABASE CONNECTION ==
// ==========================================================
const DB_URL = "mongodb+srv://SIPADAM_db_user:gibranpermadi@cluster0.mufnsjc.mongodb.net/sipadam?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(DB_URL)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ Failed to connect to MongoDB:', err.message));

// ==========================================================
// == DATABASE SCHEMA ==
// ==========================================================
const LaporanSchema = new mongoose.Schema({
  lokasi: String,
  catatan: String,
  waktu: String,
  status: { type: String, default: 'Aktif' },
  image: String,
  tipeLaporan: { type: String, default: 'Warga' },
  suhu: String,
  kelembaban: String, 
  intensitas: String,
  co: String,
  tempRate: String,
  smokeRate: String,
  coRate: String,
  riskLevel: String
});

const Laporan = mongoose.model('Laporan', LaporanSchema);

// ==========================================================
// == STATIC FILES ==
// ==========================================================
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/admin", express.static(path.join(__dirname, "admin")));

console.log("📁 Static files configured:");
console.log("   Public: " + path.join(__dirname, "public"));
console.log("   Admin: " + path.join(__dirname, "admin"));

// ==========================================================
// == ADMIN ROUTES ==
// ==========================================================
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
// == USER PAGE ROUTES - EXPLICIT ==
// ==========================================================
app.get("/public", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/public/index", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/public/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

app.get("/public/daftar", (req, res) => {
  res.sendFile(path.join(__dirname, "public/daftar.html"));
});

app.get("/public/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

app.get("/public/friendlist", (req, res) => {
  res.sendFile(path.join(__dirname, "public/friendlist.html"));
});

app.get("/public/laporan", (req, res) => {
  res.sendFile(path.join(__dirname, "public/laporan.html"));
});

app.get("/public/profil", (req, res) => {
  res.sendFile(path.join(__dirname, "public/profil.html"));
});

console.log("✅ User page routes configured");

// ==========================================================
// == API ENDPOINTS ==
// ==========================================================

// Get all reports
app.get('/api/laporan', async (req, res) => {
  try {
    const semuaLaporan = await Laporan.find().sort({_id: -1}); 
    res.json(semuaLaporan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single report
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

// Update report status
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

// ==========================================================
// == SERVER START ==
// ==========================================================
const PORT = 3000;
server.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log("🔥 SIPADAM SERVER STARTED");
  console.log("=".repeat(60));
  console.log(`📡 Server URL: http://localhost:${PORT}`);
  console.log(`👥 User Pages: http://localhost:${PORT}/public`);
  console.log(`🔐 Admin Panel: http://localhost:${PORT}/admin`);
  console.log("=".repeat(60) + "\n");
});

// ==========================================================
// == ESP32 SENSOR BRIDGE ==
// ==========================================================
const ESP32_IP_ADDRESS = "http://192.168.10.96"; 

async function ambilDataSensor() {
  try {
    const response = await fetch(`${ESP32_IP_ADDRESS}/api/data`); 
    if (!response.ok) throw new Error("ESP32 Gagal Fetch");
    
    const dataSensor = await response.json();
    io.emit("data-sensor", dataSensor);

    if (dataSensor.riskLevel === 'HIGH' || dataSensor.riskLevel === 'CRITICAL') {
      console.log('🚨 SENSOR BAHAYA: Membuat laporan otomatis...');
      
      const laporanSensor = new Laporan({
        lokasi: dataSensor.location || '-6.9820, 110.4153',
        catatan: 'Laporan otomatis dari Sensor: ' + (dataSensor.sensorName || 'Sensor Utama'), 
        waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        status: 'Aktif',
        image: null,
        tipeLaporan: 'Sensor',
        suhu: dataSensor.temperature ? `${dataSensor.temperature}°C` : '--°C',
        kelembaban: dataSensor.humidity ? `${dataSensor.humidity}%` : '--%', 
        intensitas: dataSensor.smoke_ppm ? `${dataSensor.smoke_ppm} ppm` : '-- ppm',
        co: dataSensor.co_ppm ? `${dataSensor.co_ppm} ppm` : '-- ppm',
        tempRate: dataSensor.tempRate ? `${dataSensor.tempRate}°C/s` : '--°C/s',
        smokeRate: dataSensor.smokeRate ? `${dataSensor.smokeRate} ppm/s` : '-- ppm/s',
        coRate: dataSensor.coRate ? `${dataSensor.coRate} ppm/s` : '-- ppm/s',
        riskLevel: dataSensor.riskLevel || 'UNKNOWN'
      });

      const laporanTersimpan = await laporanSensor.save();
      io.to('ruangan-admin').emit('laporan-masuk', laporanTersimpan);
      console.log('✅ Laporan sensor otomatis tersimpan dan dikirim ke admin');
    }

  } catch (error) {
    console.error("Gagal terhubung ke ESP32:", error.message);
    io.emit("data-error", { message: "ESP32 tidak terhubung." });
  }
}

setInterval(ambilDataSensor, 2000);

// ==========================================================
// == SOCKET.IO HANDLERS ==
// ==========================================================
io.on("connection", (socket) => {
  console.log("🔌 New connection:", socket.id);

  // Send Python status on connect
  socket.emit('python-status', { 
    status: pythonReady ? 'ready' : (pythonProcess ? 'starting' : 'stopped'),
    message: pythonReady ? 'Fire detection system ready' : 'Starting...'
  });

  // Admin join room
  socket.on('admin-bergabung', async () => { 
    socket.join('ruangan-admin');
    console.log(`Socket ${socket.id} (ADMIN) joined room`);

    try {
      const laporanLama = await Laporan.find().sort({_id: -1}).limit(10);
      socket.emit('muat-laporan-lama', laporanLama); 
    } catch (err) {
      console.error('Failed to load old reports:', err);
    }
  });
  
  // New report
  socket.on('laporan-baru', async (dataLaporan) => { 
    const tipe = dataLaporan.tipeLaporan || 'Warga';
    console.log(`📋 NEW REPORT from ${socket.id} (${tipe}):`, dataLaporan.lokasi);

    try {
      const laporanBaru = new Laporan({
        lokasi: dataLaporan.lokasi,
        catatan: dataLaporan.catatan,
        waktu: dataLaporan.waktu,
        image: dataLaporan.image,
        tipeLaporan: tipe,
        suhu: dataLaporan.suhu,
        kelembaban: dataLaporan.kelembaban,
        intensitas: dataLaporan.intensitas,
        co: dataLaporan.co,
        tempRate: dataLaporan.tempRate,
        smokeRate: dataLaporan.smokeRate,
        coRate: dataLaporan.coRate,
        riskLevel: dataLaporan.riskLevel
      });
      
      const laporanTersimpan = await laporanBaru.save(); 
      io.to('ruangan-admin').emit('laporan-masuk', laporanTersimpan); 
      
      console.log(`✅ Report saved and broadcasted to admin`);
      
    } catch (err) {
      console.error('❌ Failed to save report:', err);
    }
  });
  
  // Camera control
  socket.on('start-camera', () => {
    console.log(`📹 User ${socket.id} requested START camera`);
    
    if (!pythonProcess) {
      startPythonScript();
      socket.emit('camera-response', { success: true, message: 'Starting fire detection system...' });
      
      setTimeout(() => {
        if (pythonReady) {
          io.emit('camera-control', { action: 'start' });
        }
      }, 2000);
    } else {
      io.emit('camera-control', { action: 'start' });
      socket.emit('camera-response', { success: true, message: 'Camera starting...' });
    }
  });
  
  socket.on('stop-camera', () => {
    console.log(`🛑 User ${socket.id} requested STOP camera`);
    io.emit('camera-control', { action: 'stop' });
    socket.emit('camera-response', { success: true, message: 'Camera stopped' });
  });
  
  socket.on('get-camera-status', () => {
    io.emit('get-camera-status', {});
  });
  
  // Camera status from Python
  socket.on('camera-status', (data) => {
    console.log(`📷 Camera status update:`, data);
    io.emit('camera-status-update', data);
  });
  
  // Fire detection from Python
  socket.on('fire-detection', (data) => {
    io.emit('fire-detection-update', data);
  });
  
  // Video streaming
  socket.on('video-frame', (data) => {
    io.emit('video-stream', { frame: data.frame });
  });
  
  // Python restart
  socket.on('restart-python', () => {
    console.log(`🔄 User ${socket.id} requested Python restart`);
    stopPythonScript();
    setTimeout(() => {
      startPythonScript();
    }, 1000);
  });
  
  socket.on("disconnect", () => {
    console.log(`🔌 Socket ${socket.id} disconnected`);
  });
});

// ==========================================================
// == GRACEFUL SHUTDOWN ==
// ==========================================================
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  stopPythonScript();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  stopPythonScript();
  process.exit(0);
});