// ============================================
// PROFIL.JS - Profile Page Handler
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  let currentAvatar = null;

  // Load user data
  loadUserData();
  loadReportHistory();
  updateStats();

  function loadUserData() {
    const savedUser = window.SipadamUtils?.Storage?.get('sipadam_user');
    if (savedUser) {
      document.getElementById('username').textContent = savedUser;
      document.getElementById('avatarInitial').textContent = savedUser.charAt(0).toUpperCase();
    }
  }

  function loadReportHistory() {
    const riwayat = window.SipadamUtils?.Storage?.get('sipadam_riwayat') || [];
    const historyList = document.getElementById('historyList');
    
    if (riwayat.length === 0) {
      historyList.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <p>📋 Belum ada riwayat laporan</p>
          <p style="font-size: 0.9rem; margin-top: 10px;">Laporan Anda akan muncul di sini setelah mengirim laporan kebakaran</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = '';
    
    riwayat.forEach(item => {
      const statusClass = `status-${item.status.toLowerCase().replace(/\s/g, '-')}`;
      
      historyList.innerHTML += `
        <div class="history-item">
          <h4>📍 ${item.lokasi}</h4>
          <p>📅 ${item.tanggal} - ${item.waktu}</p>
          <p>📝 ${item.catatan}</p>
          ${item.foto !== 'Tidak ada foto' ? `<p>📸 ${item.foto}</p>` : ''}
          <span class="status-badge ${statusClass}">${item.status}</span>
        </div>
      `;
    });
  }

  function updateStats() {
    const riwayat = window.SipadamUtils?.Storage?.get('sipadam_riwayat') || [];
    
    const total = riwayat.length;
    const selesai = riwayat.filter(r => r.status === 'Selesai').length;
    const proses = riwayat.filter(r => r.status === 'Ditangani' || r.status === 'Diterima').length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statSelesai').textContent = selesai;
    document.getElementById('statProses').textContent = proses;
  }

  // Modal functions
  window.openModal = function(modalId) {
    document.getElementById(modalId).classList.add('active');
  };

  window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
  };

  window.openEditModal = function() {
    // Isi form dengan data saat ini
    document.getElementById('editNama').value = document.getElementById('nama').textContent;
    document.getElementById('editEmail').value = document.getElementById('email').textContent;
    document.getElementById('editTelepon').value = document.getElementById('telepon').textContent;
    openModal('modalEdit');
  };

  window.openHistoryModal = function() {
    loadReportHistory();
    openModal('modalHistory');
  };

  window.openAvatarModal = function() {
    const preview = document.getElementById('avatarPreview');
    const currentStyle = document.getElementById('avatarCircle').style.backgroundImage;
    preview.style.backgroundImage = currentStyle || 'linear-gradient(135deg, #e63946, #ff4d4d)';
    openModal('modalAvatar');
  };

  window.previewAvatar = function(event) {
    const file = event.target.files[0];
    if (file) {
      // Validasi file
      if (!file.type.startsWith('image/')) {
        if (window.SipadamUtils) {
          window.SipadamUtils.showToast('⚠️ File harus berupa gambar', 'error');
        }
        event.target.value = '';
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        if (window.SipadamUtils) {
          window.SipadamUtils.showToast('⚠️ Ukuran file maksimal 2MB', 'error');
        }
        event.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        currentAvatar = e.target.result;
        document.getElementById('avatarPreview').style.backgroundImage = `url(${e.target.result})`;
      };
      reader.readAsDataURL(file);
    }
  };

  window.saveAvatar = function() {
    if (currentAvatar) {
      const avatarCircle = document.getElementById('avatarCircle');
      avatarCircle.style.backgroundImage = `url(${currentAvatar})`;
      avatarCircle.style.backgroundSize = 'cover';
      avatarCircle.style.backgroundPosition = 'center';
      document.getElementById('avatarInitial').style.display = 'none';
      
      closeModal('modalAvatar');
      if (window.SipadamUtils) {
        window.SipadamUtils.showToast('✅ Foto profil berhasil diperbarui!', 'success');
      }
    } else {
      if (window.SipadamUtils) {
        window.SipadamUtils.showToast('⚠️ Pilih foto terlebih dahulu', 'error');
      }
    }
  };

  // Handle form edit submit
  document.getElementById('formEdit').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nama = document.getElementById('editNama').value;
    const email = document.getElementById('editEmail').value;
    const telepon = document.getElementById('editTelepon').value;
    
    // Validasi
    if (nama.length < 3) {
      if (window.SipadamUtils) {
        window.SipadamUtils.showToast('⚠️ Nama minimal 3 karakter', 'error');
      }
      return;
    }

    if (!window.SipadamUtils?.validateEmail(email)) {
      if (window.SipadamUtils) {
        window.SipadamUtils.showToast('⚠️ Format email tidak valid', 'error');
      }
      return;
    }

    if (!window.SipadamUtils?.validatePhone(telepon)) {
      if (window.SipadamUtils) {
        window.SipadamUtils.showToast('⚠️ Nomor telepon tidak valid', 'error');
      }
      return;
    }
    
    // Update tampilan
    document.getElementById('nama').textContent = nama;
    document.getElementById('email').textContent = email;
    document.getElementById('telepon').textContent = telepon;
    
    closeModal('modalEdit');
    
    if (window.SipadamUtils) {
      window.SipadamUtils.showToast('✅ Profil berhasil diperbarui!', 'success');
    }
  });

  window.handleLogout = function() {
    if (confirm('🔓 Apakah Anda yakin ingin keluar?')) {
      if (window.SipadamUtils?.Storage) {
        window.SipadamUtils.Storage.remove('sipadam_user');
        window.SipadamUtils.Storage.remove('sipadam_logged_in');
      }
      
      if (window.SipadamUtils) {
        window.SipadamUtils.showToast('✅ Anda telah keluar. Terima kasih!', 'success');
      }
      
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
    }
  };

  // Close modal when clicking outside
  window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      if (event.target === modal) {
        modal.classList.remove('active');
      }
    });
  };
});