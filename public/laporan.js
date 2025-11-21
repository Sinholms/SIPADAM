// ============================================
// LAPORAN.JS - Versi FINAL (Tersambung ke Server)
// ============================================

// Pastikan kode ini berjalan SETELAH main.js dan socket.io.js dimuat
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
    console.error('main.js (SipadamUtils) not loaded! Pastikan main.js dimuat sebelum laporan.js');
    return;
  }

  // 1. Hubungkan ke "Otak" (server.js)
  const socket = io();

  // 2. Deklarasi Variabel
  let map, marker;
  let userLat, userLng;
  let selectedFile = null;

  const formLaporan = document.getElementById('formLaporan');
  const inputLokasi = document.getElementById('inputLokasi');
  const statusGPS = document.getElementById('statusGPS');
  const catatanInput = document.getElementById('catatan');
  const inputFile = document.getElementById('fotoKebakaran');

  // ===== TAMBAHKAN 3 BARIS INI =====
  const inputSuhu = document.getElementById('suhu');
  const inputKelembaban = document.getElementById('kelembaban');
  const inputIntensitas = document.getElementById('intensitas');
  // ===================================

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
    const maxSize = 2 * 1024 * 1024; // 2MB
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
      selectedFile = file; // Simpan file-nya
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
        initMap(-6.9667, 110.4167); // Default Semarang
      }
    );
  } else {
    statusGPS.textContent = '❌ Browser tidak mendukung GPS.';
    initMap(-6.9667, 110.4167); // Default Semarang
  }


  // ==========================================================
  // ===== LOGIKA BARU: DENGARKAN DATA SENSOR OTOMATIS =====
  // ==========================================================
  // Ini akan otomatis mengisi field input setiap server mengirim data baru
  socket.on('data-sensor', (data) => {
    // console.log('Data sensor diterima di halaman laporan:', data); 

    // Cek jika elemennya ada dan datanya tersedia
    if (data.temperature !== undefined && inputSuhu) {
      inputSuhu.value = data.temperature; 
    }
    if (data.humidity !== undefined && inputKelembaban) {
      inputKelembaban.value = data.humidity;
    }
    // Menggunakan data 'smoke_ppm' untuk 'intensitas'
    if (data.smoke_ppm !== undefined && inputIntensitas) {
      inputIntensitas.value = data.smoke_ppm;
    }
  });
  // ==========================================================


  // ==========================================================
  // 6. LOGIKA SUBMIT BARU (KIRIM KE SERVER)
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
      
      // Ambil data dari semua input
      const lokasi = inputLokasi.value;
      const catatan = catatanInput.value;
      const file = selectedFile;
      
      // ===== AMBIL DATA SENSOR BARU =====
      const suhuInput = document.getElementById('suhu').value;
      const kelembabanInput = document.getElementById('kelembaban').value;
      const intensitasInput = document.getElementById('intensitas').value;
      // ===================================

      // Fungsi untuk menyelesaikan & redirect
      const finishSubmission = (dataLaporan) => {
          // 1. KIRIM DATA KE SERVER
          socket.emit('laporan-baru', dataLaporan);
          
          // 2. Simpan ke riwayat lokal (agar profil.html tetap berfungsi)
          simpanKeRiwayatLokal(dataLaporan, file);

          window.SipadamUtils.showToast('✅ Laporan berhasil terkirim!', 'success');
          formLaporan.reset();
          removePhoto();
          
          setTimeout(() => {
            window.location.href = 'dashboard.html'; // Arahkan ke dashboard
          }, 2000);
      };

      // Logika pengiriman foto (Base64)
      if (file) {
          // KASUS 1: JIKA ADA FOTO
          const reader = new FileReader();
          reader.readAsDataURL(file); // Ubah file jadi string Base64
          
          reader.onload = () => {
            const base64Image = reader.result; // String "data:image/..."
            
            // ===== BUAT OBJEK DATA LAPORAN (TERMASUK SENSOR) =====
            const dataLaporan = {
                lokasi: lokasi,
                catatan: catatan || "Tidak ada catatan.",
                waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                image: base64Image,
                suhu: suhuInput ? `${suhuInput}°C` : '--°C',
                kelembaban: kelembabanInput ? `${kelembabanInput}%` : '--%',
                intensitas: intensitasInput || '--'
            };
            finishSubmission(dataLaporan);
          };
          
          reader.onerror = (error) => {
             console.error('Error membaca file:', error);
             window.SipadamUtils.showToast('Gagal membaca file foto', 'error');
             restoreBtn();
          };
          
      } else {
          // KASUS 2: JIKA TIDAK ADA FOTO
          // ===== BUAT OBJEK DATA LAPORAN (TERMASUK SENSOR) =====
          const dataLaporan = {
              lokasi: lokasi,
              catatan: catatan || "Tidak ada catatan.",
              waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
              image: null,
              suhu: suhuInput ? `${suhuInput}°C` : '--°C',
              kelembaban: kelembabanInput ? `${kelembabanInput}%` : '--%',
              intensitas: intensitasInput || '--'
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
          status: 'Diterima' // Status awal
        };
        let riwayat = window.SipadamUtils.Storage.get('sipadam_riwayat') || [];
        riwayat.unshift(laporan);
        window.SipadamUtils.Storage.set('sipadam_riwayat', riwayat);
      } catch (e) {
        console.warn("Gagal menyimpan riwayat ke storage lokal:", e);
      }
  }

}); // Penutup DOMContentLoaded