// main.js

// ===================================================================
// FUNGSI GLOBAL (DI LUAR DOMContentLoaded)
// Ini adalah fungsi "alat" yang bisa dipanggil oleh skrip lain.
// ===================================================================

/**
 * Menampilkan notifikasi "Toast" yang meluncur
 */
function showToastNotification(notif) {
  const toast = document.createElement('div');
  toast.classList.add('toast-notification');
  toast.innerHTML = `
    <span class="toast-icon">${notif.icon}</span>
    <div class="toast-content">
      <h4>${notif.title}</h4>
      <p>${notif.time}</p>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 5000);
}

/**
 * Menambahkan notifikasi baru ke dropdown dan mengupdate badge
 */
function addNewNotification(newReport) {
  // Ambil elemen list notifikasi
  const notificationList = document.getElementById("notificationList");
  const notificationBadge = document.getElementById("notificationBadge");

  // Pastikan elemennya ada sebelum melanjutkan
  if (!notificationList || !notificationBadge) {
    console.warn("Elemen notifikasi (list atau badge) tidak ditemukan!");
    return;
  }

  // 1. Buat data notifikasi dari laporan baru
  const newNotif = {
    id: newReport.id,
    title: `Laporan Baru: ${newReport.location}`, // Gunakan data lokasi
    time: "Baru saja",
    icon: "🔥",
    link: `detail-laporan.html?id=${newReport.id}`, // Gunakan data ID
    isNew: true
  };

  // 2. Hapus pesan "Tidak ada notifikasi baru" jika ada
  const noNotifMessage = notificationList.querySelector('.no-notif-message');
  if (noNotifMessage) {
    noNotifMessage.remove();
  }

  // 3. Buat elemen HTML untuk notifikasi baru
  const notifItem = document.createElement('a');
  notifItem.href = newNotif.link;
  notifItem.classList.add('dropdown-item', 'new');
  notifItem.innerHTML = `
    <span class="item-icon">${newNotif.icon}</span>
    <div class="item-content">
      <h4>${newNotif.title}</h4>
      <p>${newNotif.time}</p>
    </div>
  `;
  
  // 4. Tambahkan notifikasi baru ke bagian ATAS daftar
  notificationList.prepend(notifItem);

  // 5. Update badge angka
  let currentCount = parseInt(notificationBadge.textContent || '0');
  currentCount++;
  notificationBadge.textContent = currentCount;
  notificationBadge.style.display = 'block';

  // 6. Tampilkan toast
  showToastNotification(newNotif);
}

// ===================================================================
// KODE YANG DIJALANKAN SAAT HALAMAN DIMUAT
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
  
  // 1. Logika Toggle Sidebar
  const menuToggle = document.getElementById("menu-toggle-btn");
  const body = document.body;

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      body.classList.toggle("sidebar-open");
    });
  }

  // 2. Logika Dropdown Notifikasi (Tombol Klik Bel)
  const notificationBell = document.getElementById("notificationBell");
  const notificationDropdown = document.getElementById("notificationDropdown");
  const notificationList = document.getElementById("notificationList");
  const clearAllNotifications = document.getElementById("clearAllNotifications");
  const notificationBadge = document.getElementById("notificationBadge");

  // Fungsi untuk render data awal
  function renderInitialNotifications() {
    if (notificationList && notificationList.children.length === 0) {
      notificationList.innerHTML = '<p class="no-notif-message" style="padding: 15px; text-align: center; color: #777;">Tidak ada notifikasi baru.</p>';
    }
  }

  renderInitialNotifications();

  // Toggle dropdown saat bel diklik
  if (notificationBell) {
    notificationBell.addEventListener("click", (e) => {
      e.preventDefault();
      notificationDropdown.classList.toggle("show");
      
      // Saat dropdown dibuka, reset badge ke 0 dan hapus status 'new'
      notificationBadge.textContent = '';
      notificationBadge.style.display = 'none';
      notificationList.querySelectorAll('.dropdown-item.new').forEach(item => {
        item.classList.remove('new');
      });
    });
  }

  // Tutup dropdown jika klik di luar
  window.addEventListener("click", (e) => {
    if (notificationBell && notificationDropdown && !notificationBell.contains(e.target) && !notificationDropdown.contains(e.target)) {
      notificationDropdown.classList.remove("show");
    }
  });

  // Bersihkan semua notifikasi
  if (clearAllNotifications) {
    clearAllNotifications.addEventListener('click', () => {
      notificationList.innerHTML = ''; // Kosongkan list
      renderInitialNotifications(); // Tampilkan pesan "Tidak ada notifikasi"
    });
  }

  // CATATAN: Listener Socket.IO (adminSocket.on) TIDAK ADA DI SINI
  // Listener itu ada di file dashboard.html
});