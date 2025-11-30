// ============================================
// LAPORAN.JS - CLIENT VERSION (Auto Report ke Operator)
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  
  // Cek dependensi
  if (typeof L === 'undefined') {
    console.error('Leaflet not loaded! Add CDN to HTML <head>');
    return;
  }
  if (typeof io === 'undefined') {
    console.error('Socket.IO not loaded! Add CDN to HTML <head>');
    return;
  }
  if (typeof window.SipadamUtils === 'undefined') {
    console.error('main.js (SipadamUtils) not loaded!');
    return;
  }

  // 1. Hubungkan ke Server
  const socket = io();

  // 2. Deklarasi Variabel
  let map, marker;
  let userLat, userLng;
  let selectedFile = null;
  
  // ===== TRACKING AUTO REPORT =====
  let lastAutoReportTime = 0;
  let hasAutoReported = false;
  const AUTO_REPORT_COOLDOWN = 300000; // 5 menit (300000 ms)

  const formLaporan = document.getElementById('formLaporan');
  const inputLokasi = document.getElementById('inputLokasi');
  const statusGPS = document.getElementById('statusGPS');
  const catatanInput = document.getElementById('catatan');
  const inputFile = document.getElementById('fotoKebakaran');

  // ===== SEMUA INPUT SENSOR =====
  const inputSuhu = document.getElementById('suhu');
  const inputKelembaban = document.getElementById('kelembaban');
  const inputIntensitas = document.getElementById('intensitas');
  const inputCO = document.getElementById('co');
  const inputTempRate = document.getElementById('tempRate');
  const inputSmokeRate = document.getElementById('smokeRate');
  const inputCORate = document.getElementById('coRate');
  const inputRiskLevel = document.getElementById('riskLevel');

  // 3. Fungsi Inisialisasi Peta
  function initMap(lat, lng) {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    if (!map) {
      map = L.map('map').setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
    } else {
      map.setView([lat, lng], 15);
    }
    
    if (marker) map.removeLayer(marker);

    marker = L.marker([lat, lng], {
      draggable: true,
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
      })
    }).addTo(map);

    marker.bindPopup('📍 Lokasi Kebakaran').openPopup();

    marker.on('dragend', function(e) {
      const pos = marker.getLatLng();
      userLat = pos.lat;
      userLng = pos.lng;
      inputLokasi.value = `${userLat.toFixed(6)}, ${userLng.toFixed(6)}`;
    });

    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      userLat = e.latlng.lat;
      userLng = e.latlng.lng;
      inputLokasi.value = `${userLat.toFixed(6)}, ${userLng.toFixed(6)}`;
    });
  }

  // 4. Fungsi Validasi & Handler Foto
  function validateFile(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, message: '⚠️ File harus berupa gambar' };
    }
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return { valid: false, message: `⚠️ Ukuran file maks 2MB` };
    }
    return { valid: true };
  }

  window.handleFileSelect = function(event) {
    const file = event.target.files[0];
    if (file) {
      const validation = validateFile(file);
      if (!validation.valid) {
        window.SipadamUtils.showToast(validation.message, 'error');
        event.target.value = '';
        return;
      }
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = function(e) {
        document.getElementById('previewImage').src = e.target.result;
        document.getElementById('previewContainer').classList.add('show');
        document.getElementById('fileLabel').classList.add('has-file');
        document.getElementById('fileLabel').innerHTML = '<span>✅</span><span>Foto telah dipilih</span>';
      };
      reader.readAsDataURL(file);
    }
  };

  window.removePhoto = function() {
    selectedFile = null;
    if (inputFile) inputFile.value = '';
    document.getElementById('previewContainer').classList.remove('show');
    document.getElementById('fileLabel').classList.remove('has-file');
    document.getElementById('fileLabel').innerHTML = '<span>📷</span><span>Pilih foto dari perangkat Anda</span>';
  };

  // 5. Deteksi GPS
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position) {
        userLat = position.coords.latitude;
        userLng = position.coords.longitude;
        inputLokasi.value = `${userLat.toFixed(6)}, ${userLng.toFixed(6)}`;
        statusGPS.textContent = '✅ Lokasi terdeteksi! Anda dapat menggeser marker.';
        statusGPS.style.color = '#2e7d32';
        initMap(userLat, userLng);
      },
      function(error) {
        statusGPS.textContent = '⚠️ Gagal deteksi lokasi. Klik peta untuk menandai.';
        statusGPS.style.color = '#e63946';
        initMap(-6.9667, 110.4167);
      }
    );
  } else {
    statusGPS.textContent = '❌ Browser tidak mendukung GPS.';
    initMap(-6.9667, 110.4167);
  }

  // ==========================================================
  // ===== AUTO REPORT SYSTEM (TRIGGER OTOMATIS) =====
  // ==========================================================
  
  function shouldTriggerAutoReport(riskLevel) {
    // Trigger hanya untuk level HIGH dan CRITICAL
    if (riskLevel !== 'HIGH' && riskLevel !== 'CRITICAL') {
      return false;
    }
    
    // Cek cooldown (jangan spam report)
    const now = Date.now();
    if (now - lastAutoReportTime < AUTO_REPORT_COOLDOWN) {
      console.log('⏳ Auto-report masih dalam cooldown...');
      return false;
    }
    
    return true;
  }

  function sendAutoReport(dataSensor) {
    console.log('🚨 TRIGGERING AUTO REPORT!');
    
    // Pastikan ada koordinat
    if (!userLat || !userLng) {
      console.warn('❌ Tidak ada koordinat GPS, auto-report dibatalkan');
      return;
    }
    
    const lokasi = `${userLat.toFixed(6)}, ${userLng.toFixed(6)}`;
    const waktu = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    // Buat laporan otomatis
    const laporanOtomatis = {
      lokasi: lokasi,
      catatan: `⚠️ LAPORAN OTOMATIS - Sistem mendeteksi level bahaya ${dataSensor.riskLevel}. Harap segera ditindaklanjuti!`,
      waktu: waktu,
      image: null,
      tipeLaporan: 'Auto',
      
      // Data sensor lengkap
      suhu: dataSensor.suhu || '--°C',
      kelembaban: dataSensor.kelembaban || '--%',
      intensitas: dataSensor.intensitas || '-- ppm',
      co: dataSensor.co || '-- ppm',
      tempRate: dataSensor.tempRate || '--°C/s',
      smokeRate: dataSensor.smokeRate || '-- ppm/s',
      coRate: dataSensor.coRate || '-- ppm/s',
      riskLevel: dataSensor.riskLevel
    };
    
    // Kirim ke server
    socket.emit('laporan-baru', laporanOtomatis);
    
    // Update tracking
    lastAutoReportTime = Date.now();
    hasAutoReported = true;
    
    // Tampilkan notifikasi ke user
    window.SipadamUtils.showToast(
      `🚨 Laporan darurat otomatis telah dikirim ke operator! (Level: ${dataSensor.riskLevel})`,
      'warning'
    );
    
    // Simpan ke riwayat lokal
    simpanKeRiwayatLokal(laporanOtomatis, null);
  }

  // ==========================================================
  // ===== AUTO-FILL DATA SENSOR & TRIGGER AUTO REPORT =====
  // ==========================================================
  socket.on('data-sensor', (data) => {
    console.log('📡 Data sensor diterima:', data); 

    // Basic Readings
    if (data.temperature !== undefined && inputSuhu) {
      inputSuhu.value = `${Number(data.temperature).toFixed(1)}°C`;
    }
    if (data.humidity !== undefined && inputKelembaban) {
      inputKelembaban.value = `${Number(data.humidity).toFixed(1)}%`;
    }
    if (data.smoke_ppm !== undefined && inputIntensitas) {
      inputIntensitas.value = `${Number(data.smoke_ppm).toFixed(2)} ppm`;
    }
    if (data.co_ppm !== undefined && inputCO) {
      inputCO.value = `${Number(data.co_ppm).toFixed(2)} ppm`;
    }

    // Rate of Change
    if (data.tempRate !== undefined && inputTempRate) {
      inputTempRate.value = `${Number(data.tempRate).toFixed(2)}°C/s`;
    }
    if (data.smokeRate !== undefined && inputSmokeRate) {
      inputSmokeRate.value = `${Number(data.smokeRate).toFixed(2)} ppm/s`;
    }
    if (data.coRate !== undefined && inputCORate) {
      inputCORate.value = `${Number(data.coRate).toFixed(2)} ppm/s`;
    }

    // Risk Level
    if (data.riskLevel !== undefined && inputRiskLevel) {
      inputRiskLevel.value = data.riskLevel;
      
      // Styling berdasarkan level bahaya
      if (data.riskLevel === 'CRITICAL') {
        inputRiskLevel.style.backgroundColor = '#ffe0e0';
        inputRiskLevel.style.color = '#e63946';
        inputRiskLevel.style.fontWeight = 'bold';
      } else if (data.riskLevel === 'HIGH') {
        inputRiskLevel.style.backgroundColor = '#fff3cd';
        inputRiskLevel.style.color = '#ff9800';
        inputRiskLevel.style.fontWeight = 'bold';
      } else if (data.riskLevel === 'MEDIUM') {
        inputRiskLevel.style.backgroundColor = '#fff8e1';
        inputRiskLevel.style.color = '#f57c00';
        inputRiskLevel.style.fontWeight = '600';
      } else {
        inputRiskLevel.style.backgroundColor = '#e8f5e9';
        inputRiskLevel.style.color = '#2e7d32';
        inputRiskLevel.style.fontWeight = 'normal';
        
        // Reset flag jika kembali normal
        hasAutoReported = false;
      }
      
      // ===== CEK AUTO REPORT TRIGGER =====
      if (shouldTriggerAutoReport(data.riskLevel) && !hasAutoReported) {
        // Prepare data untuk auto report
        const dataSensorForReport = {
          suhu: inputSuhu.value,
          kelembaban: inputKelembaban.value,
          intensitas: inputIntensitas.value,
          co: inputCO.value,
          tempRate: inputTempRate.value,
          smokeRate: inputSmokeRate.value,
          coRate: inputCORate.value,
          riskLevel: data.riskLevel
        };
        
        sendAutoReport(dataSensorForReport);
      }
    }
  });

  // ==========================================================
  // 6. SUBMIT FORM MANUAL (USER TETAP BISA LAPOR MANUAL)
  // ==========================================================
  if (formLaporan) {
    formLaporan.addEventListener('submit', function(e) {
      e.preventDefault();
      
      if (!userLat || !userLng) {
        window.SipadamUtils.showToast('⚠️ Lokasi belum terdeteksi', 'error');
        return;
      }

      const btn = this.querySelector('button[type="submit"]');
      const restoreBtn = window.SipadamUtils.showLoading(btn);
      
      const lokasi = inputLokasi.value;
      const catatan = catatanInput.value;
      const file = selectedFile;
      
      // Ambil semua data sensor
      const suhuValue = inputSuhu.value || '--°C';
      const kelembabanValue = inputKelembaban.value || '--%';
      const intensitasValue = inputIntensitas.value || '-- ppm';
      const coValue = inputCO.value || '-- ppm';
      const tempRateValue = inputTempRate.value || '--°C/s';
      const smokeRateValue = inputSmokeRate.value || '-- ppm/s';
      const coRateValue = inputCORate.value || '-- ppm/s';
      const riskLevelValue = inputRiskLevel.value || 'NORMAL';

      const finishSubmission = (dataLaporan) => {
          socket.emit('laporan-baru', dataLaporan);
          simpanKeRiwayatLokal(dataLaporan, file);
          window.SipadamUtils.showToast('✅ Laporan berhasil terkirim!', 'success');
          formLaporan.reset();
          removePhoto();
          
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 2000);
      };

      if (file) {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          
          reader.onload = () => {
            const base64Image = reader.result;
            
            const dataLaporan = {
                lokasi: lokasi,
                catatan: catatan || "Tidak ada catatan.",
                waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                image: base64Image,
                tipeLaporan: 'Warga',
                suhu: suhuValue,
                kelembaban: kelembabanValue,
                intensitas: intensitasValue,
                co: coValue,
                tempRate: tempRateValue,
                smokeRate: smokeRateValue,
                coRate: coRateValue,
                riskLevel: riskLevelValue
            };
            finishSubmission(dataLaporan);
          };
          
          reader.onerror = (error) => {
             console.error('Error membaca file:', error);
             window.SipadamUtils.showToast('Gagal membaca file foto', 'error');
             restoreBtn();
          };
          
      } else {
          const dataLaporan = {
              lokasi: lokasi,
              catatan: catatan || "Tidak ada catatan.",
              waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
              image: null,
              tipeLaporan: 'Warga',
              suhu: suhuValue,
              kelembaban: kelembabanValue,
              intensitas: intensitasValue,
              co: coValue,
              tempRate: tempRateValue,
              smokeRate: smokeRateValue,
              coRate: coRateValue,
              riskLevel: riskLevelValue
          };
          finishSubmission(dataLaporan);
      }
    });
  }

  // 7. Fungsi helper untuk simpan ke riwayat lokal
  function simpanKeRiwayatLokal(dataLaporan, file) {
      try {
        const laporan = {
          id: Date.now(),
          lokasi: dataLaporan.lokasi,
          catatan: dataLaporan.catatan,
          foto: file ? file.name : 'Tidak ada foto',
          tanggal: new Date().toLocaleDateString('id-ID'),
          waktu: dataLaporan.waktu,
          status: 'Diterima',
          tipe: dataLaporan.tipeLaporan || 'Warga'
        };
        let riwayat = window.SipadamUtils.Storage.get('sipadam_riwayat') || [];
        riwayat.unshift(laporan);
        window.SipadamUtils.Storage.set('sipadam_riwayat', riwayat);
      } catch (e) {
        console.warn("Gagal menyimpan riwayat lokal:", e);
      }
  }

});