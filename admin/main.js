// main.js - FINAL VERSION

// ===================================================================
// FUNGSI GLOBAL (DI LUAR DOMContentLoaded)
// ===================================================================

/**
 * Menampilkan notifikasi "Toast" yang meluncur (Style Baru)
 */
function showToastNotification(notif) {
  const toast = document.createElement('div');
  toast.classList.add('toast-notification'); 
  
  // Struktur HTML Pop-up
  toast.innerHTML = `
    <div class="toast-icon">${notif.icon}</div>
    <div class="toast-content">
      <h4>${notif.title}</h4>
      <p>${notif.message}</p> 
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Animasi Masuk
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Hapus otomatis setelah 5 detik
  setTimeout(() => {
    toast.classList.remove('show');
    // Tunggu animasi selesai baru hapus element
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.remove();
      }
    }, 600); 
  }, 5000);
}

/**
 * Menambahkan notifikasi baru ke dropdown dan memanggil Toast
 */
function addNewNotification(newReport) {
  const notificationList = document.getElementById("notificationList");
  const notificationBadge = document.getElementById("notificationBadge");

  if (!notificationList || !notificationBadge) return;

  // Data Notifikasi
  const notifData = {
    id: newReport.id,
    title: "Kebakaran Terdeteksi!", 
    message: `Lokasi: ${newReport.location || newReport.lokasi}`, 
    time: "Baru saja",
    icon: "🔥",
    link: `detail-laporan.html?id=${newReport.id}`,
  };

  // Hapus pesan kosong
  const noNotifMessage = notificationList.querySelector('.no-notif-message');
  if (noNotifMessage) noNotifMessage.remove();

  // Item Dropdown Baru
  const notifItem = document.createElement('a');
  notifItem.href = notifData.link;
  notifItem.classList.add('dropdown-item'); 
  notifItem.style.background = "#fff8f8"; 
  
  notifItem.innerHTML = `
    <span class="item-icon" style="color: #e53935;">${notifData.icon}</span>
    <div class="item-content">
      <h4 style="font-weight: 700; color: #d32f2f;">${notifData.title}</h4>
      <p>${notifData.message}</p>
      <small style="color: #999; font-size: 0.7rem;">${notifData.time}</small>
    </div>
  `;
  
  notificationList.prepend(notifItem);

  // Update Badge
  let currentCount = parseInt(notificationBadge.textContent || '0');
  notificationBadge.textContent = currentCount + 1;
  notificationBadge.style.display = 'block';

  // Panggil Pop-up
  showToastNotification(notifData);
}

// ===================================================================
// LOGIKA UTAMA
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
  
  // 1. LOGIKA SIDEBAR (DESKTOP & MOBILE)
  const menuToggle = document.getElementById("menu-toggle-btn");
  const body = document.body;

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      // Jika layar > 768px (Desktop), gunakan logic 'sidebar-closed'
      if (window.innerWidth > 768) {
        body.classList.toggle("sidebar-closed");
      } else {
        // Jika layar kecil (Mobile), gunakan logic 'sidebar-open'
        body.classList.toggle("sidebar-open");
      }
    });
  }

  // Reset class saat resize agar tidak error tampilan
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      body.classList.remove('sidebar-open');
    } else {
      body.classList.remove('sidebar-closed');
    }
  });

  // 2. Dropdown Notifikasi
  const notificationBell = document.getElementById("notificationBell");
  const notificationDropdown = document.getElementById("notificationDropdown");
  const notificationList = document.getElementById("notificationList");
  const clearAllNotifications = document.getElementById("clearAllNotifications");
  const notificationBadge = document.getElementById("notificationBadge");

  // Pesan default jika kosong
  if (notificationList && notificationList.children.length === 0) {
    notificationList.innerHTML = '<p class="no-notif-message" style="padding: 15px; text-align: center; color: #777; font-size: 0.85rem;">Tidak ada notifikasi baru.</p>';
  }

  // Klik Bel
  if (notificationBell) {
    notificationBell.addEventListener("click", (e) => {
      e.preventDefault();
      notificationDropdown.classList.toggle("show");
      
      // Reset Badge
      if (notificationDropdown.classList.contains('show')) {
        notificationBadge.textContent = '';
        notificationBadge.style.display = 'none';
      }
    });
  }

  // Klik Luar (Tutup Dropdown)
  window.addEventListener("click", (e) => {
    if (notificationBell && notificationDropdown) {
      if (!notificationBell.contains(e.target) && !notificationDropdown.contains(e.target)) {
        notificationDropdown.classList.remove("show");
      }
    }
  });

  // Bersihkan Semua
  if (clearAllNotifications) {
    clearAllNotifications.addEventListener('click', () => {
      notificationList.innerHTML = '<p class="no-notif-message" style="padding: 15px; text-align: center; color: #777; font-size: 0.85rem;">Tidak ada notifikasi baru.</p>';
    });
  }
});