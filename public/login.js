// ============================================
// LOGIN.JS - Login Page Handler
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  const formLogin = document.getElementById('formLogin');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const rememberCheckbox = document.getElementById('remember');

  // Cek jika ada user tersimpan
  const savedUser = window.SipadamUtils?.Storage?.get('sipadam_user');
  if (savedUser) {
    usernameInput.value = savedUser;
    rememberCheckbox.checked = true;
  }

  // Handle form submit
  formLogin.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const remember = rememberCheckbox.checked;

    // Validasi
    if (!username || username.length < 3) {
      if (window.SipadamUtils) {
        window.SipadamUtils.showToast('❌ Username minimal 3 karakter', 'error');
      }
      return;
    }

    if (!password || password.length < 6) {
      if (window.SipadamUtils) {
        window.SipadamUtils.showToast('❌ Password minimal 6 karakter', 'error');
      }
      return;
    }

    // Simpan data login jika "ingat saya" dicentang
    if (remember && window.SipadamUtils?.Storage) {
      window.SipadamUtils.Storage.set('sipadam_user', username);
    }

    // Tampilkan loading
    const btn = this.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Memproses...';
    btn.disabled = true;

    // Simulasi login
    setTimeout(() => {
      // Set user session
      if (window.SipadamUtils?.Storage) {
        window.SipadamUtils.Storage.set('sipadam_logged_in', true);
        window.SipadamUtils.Storage.set('sipadam_user', username);
      }

      if (window.SipadamUtils) {
        window.SipadamUtils.showToast(`✅ Login berhasil! Selamat datang, ${username}!`, 'success');
      }
      
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    }, 1000);
  });
});