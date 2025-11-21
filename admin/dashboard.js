// dashboard.js

let map, userMarker;
let pendingMarkers = []; // ANTRIAN UNTUK MARKER YANG MASUK SEBELUM PETA SIAP

/**
 * Memproses semua marker yang ada di antrian (pendingMarkers).
 * Dipanggil setelah peta selesai diinisialisasi.
 */
function processPendingMarkers() {
  if (!map) return; // Pastikan map sudah ada

  console.log(`Memproses ${pendingMarkers.length} marker yang tertunda...`);
  
  pendingMarkers.forEach(markerData => {
    // Panggil fungsi addFireMarkerToMap LAGI,
    // tapi kali ini kita tahu 'map' sudah siap
    addFireMarkerToMap(markerData.coords, markerData.popupText, true);
  });
  
  // Kosongkan antrian
  pendingMarkers = [];
}

// Inisialisasi peta
function initMap(lat = -6.2, lon = 106.816666) {
  map = L.map("map").setView([lat, lon], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  userMarker = L.marker([lat, lon])
    .addTo(map)
    .bindPopup("Lokasi Anda")
    .openPopup();

  // SETELAH PETA SIAP, PROSES SEMUA MARKER YANG TERTUNDA
  processPendingMarkers();
}

// Zoom map
function zoomMap() {
  map.setZoom(map.getZoom() + 1);
}

// Panggil GPS
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      initMap(latitude, longitude);
    },
    () => {
      alert("Tidak dapat mengakses lokasi. Menampilkan default Jakarta.");
      initMap(); // Tetap inisialisasi peta walau GPS gagal
    }
  );
} else {
  alert("Browser tidak mendukung GPS.");
  initMap(); // Tetap inisialisasi peta
}

// Fungsi buka halaman detail laporan
function openDetail(page) {
  window.location.href = page;
}

// ==========================================================
// ===== FUNGSI UNTUK MENAMBAHKAN MARKER KEBAKARAN =====
// ==========================================================
/**
 * Menambahkan penanda (marker) api baru ke peta.
 * @param {Array<number>} coords - Array koordinat [latitude, longitude]
 * @param {string} popupText - Konten HTML untuk ditampilkan di popup
 * @param {boolean} [fromQueue=false] - Menandakan jika ini panggilan dari antrian
 */
function addFireMarkerToMap(coords, popupText, fromQueue = false) {
  
  // JIKA PETA BELUM SIAP:
  if (!map) {
    console.warn("Peta (map) belum siap. Menambahkan marker ke antrian...");
    // Simpan data marker untuk diproses nanti
    pendingMarkers.push({ coords, popupText });
    return;
  }

  // JIKA PETA SUDAH SIAP:
  console.log("Peta sudah siap. Menambahkan marker di:", coords);

  const fireIcon = L.divIcon({
    className: "custom-fire-icon",
    html: "🔥",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });

  const fireMarker = L.marker(coords, { icon: fireIcon })
    .addTo(map)
    .bindPopup(popupText);

  // Hanya buka popup dan panTo jika BUKAN dari antrian
  // (agar tidak mengganggu user jika ada 5 marker sekaligus)
  if (!fromQueue) {
    fireMarker.openPopup();
    map.panTo(coords);
  }
}