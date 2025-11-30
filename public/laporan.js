// ============================================
// LAPORAN.JS - GPS dari IoT Module NEO-6M
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
  
  // ===== GPS SOURCE TRACKING =====
  let gpsSource = 'none'; // 'iot', 'device', 'manual', 'none'
  let iotGpsValid = false;
  let lastIotGpsUpdate = 0;
  const GPS_TIMEOUT = 10000; // 10 detik timeout
  
  // ===== TRACKING AUTO REPORT =====
  let lastAutoReportTime = 0;
  let hasAutoReported = false;
  const AUTO_REPORT_COOLDOWN = 300000; // 5 menit

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

  // 3. Fungsi Update Status GPS
  function updateGPSStatus(source, isValid, message) {
    gpsSource = source;
    
    if (source === 'iot' && isValid) {
      statusGPS.innerHTML = `
        <span style="color: #2e7d32; font-weight: 600;">🛰️ GPS IoT Module Active</span><br>
        <span style="color: #666; font-size: 0.85em;">Koordinat dari modul NEO-6M</span>
      `;
      statusGPS.style.color = '#2e7d32';
      statusGPS.style.backgroundColor = '#e8f5e9';
      statusGPS.style.padding = '12px';
      statusGPS.style.borderRadius = '8px';
    } else if (source === 'device' && isValid) {
      statusGPS.innerHTML = `
        <span style="color: #ff9800; font-weight: 600;">📱 GPS Device (Fallback)</span><br>
        <span style="color: #666; font-size: 0.85em;">Menggunakan GPS perangkat</span>
      `;
      statusGPS.style.color = '#ff9800';
      statusGPS.style.backgroundColor = '#fff3e0';
    } else if (source === 'manual') {
      statusGPS.innerHTML = `
        <span style="color: #2196f3; font-weight: 600;">📍 Manual Location</span><br>
        <span style="color: #666; font-size: 0.85em;">Lokasi dipilih dari peta</span>
      `;
      statusGPS.style.color = '#2196f3';
      statusGPS.style.backgroundColor = '#e3f2fd';
    } else {
      statusGPS.innerHTML = `
        <span style="color: #e63946; font-weight: 600;">❌ GPS Tidak Tersedia</span><br>
        <span style="color: #666; font-size: 0.85em;">Klik peta untuk menandai lokasi manual</span>
      `;
      statusGPS.style.color = '#e63946';
      statusGPS.style.backgroundColor = '#ffebee';
    }
  }

  // 4. Fungsi Inisialisasi Peta
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

    marker.bindPopup('🔥 Lokasi Kebakaran').openPopup();

    marker.on('dragend', function(e) {
      const pos = marker.getLatLng();
      userLat = pos.lat;
      userLng = pos.lng;
      inputLokasi.value = `${userLat.toFixed(6)}, ${userLng.toFixed(6)}`;
      updateGPSStatus('manual', true);
    });

    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      userLat = e.latlng.lat;
      userLng = e.latlng.lng;
      inputLokasi.value = `${userLat.toFixed(6)}, ${userLng.toFixed(6)}`;
      updateGPSStatus('manual', true);
    });
  }

  // 5. Fungsi Validasi & Handler Foto
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

  // 6. Cek GPS IoT Timeout
  setInterval(() => {
    if (gpsSource === 'iot' && (Date.now() - lastIotGpsUpdate > GPS_TIMEOUT)) {
      console.warn('⚠️ IoT GPS timeout, switching to fallback...');
      iotGpsValid = false;
      
      // Try device GPS as fallback
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function(position) {
            userLat = position.coords.latitude;
            userLng = position.coords.longitude;
            inputLokasi.value = `${userLat.toFixed(6)}, ${userLng.toFixed(6)}`;
            updateGPSStatus('device', true);
            if (map && marker) {
              marker.setLatLng([userLat, userLng]);
              map.setView([userLat, userLng], 15);
            }
          },
          function(error) {
            updateGPSStatus('none', false);
          }
        );
      } else {
        updateGPSStatus('none', false);
      }
    }
  }, 5000);

  // 7. Inisialisasi Peta dengan default location
  initMap(-6.9820, 110.4153); // Semarang default
  updateGPSStatus('none', false);

  // ==========================================================
  // ===== RECEIVE GPS DATA FROM IoT MODULE =====
  // ==========================================================
  socket.on('data-sensor', (data) => {
    console.log('📡 Data sensor diterima:', data); 

    // ===== PRIORITAS 1: GPS dari IoT Module =====
    if (data.gpsValid && data.latitude !== 0 && data.longitude !== 0) {
      userLat = data.latitude;
      userLng = data.longitude;
      inputLokasi.value = `${userLat.toFixed(6)}, ${userLng.toFixed(6)}`;
      
      iotGpsValid = true;
      lastIotGpsUpdate = Date.now();
      updateGPSStatus('iot', true);
      
      // Update map
      if (map && marker) {
        marker.setLatLng([userLat, userLng]);
        map.setView([userLat, userLng], 16);
      } else {
        initMap(userLat, userLng);
      }
      
      console.log('🛰️ GPS IoT Updated:', userLat, userLng);
    }

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
        hasAutoReported = false;
      }
      
      // ===== CEK AUTO REPORT TRIGGER =====
      if (shouldTriggerAutoReport(data.riskLevel) && !hasAutoReported) {
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
  // ===== AUTO REPORT SYSTEM =====
  // ==========================================================
  
  function shouldTriggerAutoReport(riskLevel) {
    if (riskLevel !== 'HIGH' && riskLevel !== 'CRITICAL') {
      return false;
    }
    
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
    
    const laporanOtomatis = {
      lokasi: lokasi,
      catatan: `⚠️ LAPORAN OTOMATIS (GPS: ${gpsSource.toUpperCase()}) - Sistem mendeteksi level bahaya ${dataSensor.riskLevel}. Harap segera ditindaklanjuti!`,
      waktu: waktu,
      image: null,
      tipeLaporan: 'Auto',
      
      suhu: dataSensor.suhu || '--°C',
      kelembaban: dataSensor.kelembaban || '--%',
      intensitas: dataSensor.intensitas || '-- ppm',
      co: dataSensor.co || '-- ppm',
      tempRate: dataSensor.tempRate || '--°C/s',
      smokeRate: dataSensor.smokeRate || '-- ppm/s',
      coRate: dataSensor.coRate || '-- ppm/s',
      riskLevel: dataSensor.riskLevel
    };
    
    socket.emit('laporan-baru', laporanOtomatis);
    
    lastAutoReportTime = Date.now();
    hasAutoReported = true;
    
    window.SipadamUtils.showToast(
      `🚨 Laporan darurat otomatis dikirim! (GPS: ${gpsSource.toUpperCase()}, Level: ${dataSensor.riskLevel})`,
      'warning'
    );
    
    simpanKeRiwayatLokal(laporanOtomatis, null);
  }

  // ==========================================================
  // ===== SUBMIT FORM MANUAL =====
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
                catatan: catatan || `Laporan dari GPS ${gpsSource.toUpperCase()}`,
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
              catatan: catatan || `Laporan dari GPS ${gpsSource.toUpperCase()}`,
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

  // 8. Fungsi helper
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