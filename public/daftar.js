// ============================================
// DAFTAR.JS - Registration Page Handler
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('formDaftar');
  const inputs = {
    nama: document.getElementById('nama'),
    email: document.getElementById('email'),
    username: document.getElementById('username'),
    telepon: document.getElementById('telepon'),
    password: document.getElementById('password'),
    confirmPassword: document.getElementById('confirmPassword'),
    agree: document.getElementById('agree')
  };

  // Fungsi toggle password visibility
  window.togglePassword = function(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling;
    
    if (input.type === 'password') {
      input.type = 'text';
      icon.textContent = '🙈';
    } else {
      input.type = 'password';
      icon.textContent = '👁️';
    }
  };

  // Validasi Email
  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  // Validasi Nomor Telepon
  function validatePhone(phone) {
    const re = /^[\d\s\-\+\(\)]+$/;
    return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  // Cek kekuatan password
  function checkPasswordStrength(password) {
    const strengthDiv = document.getElementById('passwordStrength');
    let strength = 0;
    let text = '';
    let className = '';

    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/\d/)) strength++;
    if (password.match(/[^a-zA-Z\d]/)) strength++;

    if (password.length === 0) {
      strengthDiv.innerHTML = '';
      return;
    }

    if (strength <= 2) {
      text = '⚠️ Lemah';
      className = 'strength-weak';
    } else if (strength === 3) {
      text = '⚡ Sedang';
      className = 'strength-medium';
    } else {
      text = '✅ Kuat';
      className = 'strength-strong';
    }

    strengthDiv.innerHTML = `<div>${text}</div><div class="strength-bar ${className}"></div>`;
  }

  // Tampilkan error
  function showError(field, message) {
    const errorDiv = document.getElementById(`error${field.charAt(0).toUpperCase() + field.slice(1)}`);
    const input = inputs[field];
    
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    input.classList.add('input-error');
    input.classList.remove('input-success');
  }

  // Hapus error
  function clearError(field) {
    const errorDiv = document.getElementById(`error${field.charAt(0).toUpperCase() + field.slice(1)}`);
    const input = inputs[field];
    
    errorDiv.classList.remove('show');
    input.classList.remove('input-error');
    input.classList.add('input-success');
  }

  // Real-time validation
  inputs.nama.addEventListener('input', function() {
    if (this.value.length < 3) {
      showError('nama', 'Nama harus minimal 3 karakter');
    } else {
      clearError('nama');
    }
  });

  inputs.email.addEventListener('blur', function() {
    if (!validateEmail(this.value)) {
      showError('email', 'Format email tidak valid');
    } else {
      clearError('email');
    }
  });

  inputs.username.addEventListener('input', function() {
    const username = this.value.trim();
    if (username.length < 4) {
      showError('username', 'Username minimal 4 karakter');
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showError('username', 'Username hanya boleh huruf, angka, dan underscore');
    } else {
      clearError('username');
    }
  });

  inputs.telepon.addEventListener('blur', function() {
    if (!validatePhone(this.value)) {
      showError('telepon', 'Nomor telepon tidak valid (minimal 10 digit)');
    } else {
      clearError('telepon');
    }
  });

  inputs.password.addEventListener('input', function() {
    checkPasswordStrength(this.value);
    
    if (this.value.length < 8) {
      showError('password', 'Password minimal 8 karakter');
    } else {
      clearError('password');
    }

    // Re-validate confirm password
    if (inputs.confirmPassword.value) {
      if (this.value !== inputs.confirmPassword.value) {
        showError('confirmPassword', 'Password tidak cocok');
      } else {
        clearError('confirmPassword');
      }
    }
  });

  inputs.confirmPassword.addEventListener('input', function() {
    if (this.value !== inputs.password.value) {
      showError('confirmPassword', 'Password tidak cocok');
    } else {
      clearError('confirmPassword');
    }
  });

  // Submit form
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    let isValid = true;

    // Validasi semua field
    if (inputs.nama.value.trim().length < 3) {
      showError('nama', 'Nama harus minimal 3 karakter');
      isValid = false;
    }

    if (!validateEmail(inputs.email.value)) {
      showError('email', 'Format email tidak valid');
      isValid = false;
    }

    const username = inputs.username.value.trim();
    if (username.length < 4) {
      showError('username', 'Username minimal 4 karakter');
      isValid = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showError('username', 'Username hanya boleh huruf, angka, dan underscore');
      isValid = false;
    }

    if (!validatePhone(inputs.telepon.value)) {
      showError('telepon', 'Nomor telepon tidak valid');
      isValid = false;
    }

    if (inputs.password.value.length < 8) {
      showError('password', 'Password minimal 8 karakter');
      isValid = false;
    }

    if (inputs.password.value !== inputs.confirmPassword.value) {
      showError('confirmPassword', 'Password tidak cocok');
      isValid = false;
    }

    if (!inputs.agree.checked) {
      showError('agree', 'Anda harus menyetujui syarat & ketentuan');
      isValid = false;
    }

    if (!isValid) {
      if (window.SipadamUtils) {
        window.SipadamUtils.showToast('❌ Mohon perbaiki kesalahan pada form', 'error');
      }
      return;
    }

    // Jika validasi berhasil
    const btn = this.querySelector('button');
    btn.textContent = '⏳ Memproses...';
    btn.disabled = true;

    // Simulasi pendaftaran
    setTimeout(() => {
      if (window.SipadamUtils) {
        window.SipadamUtils.Storage.set('sipadam_user', username);
        window.SipadamUtils.Storage.set('sipadam_logged_in', true);
        window.SipadamUtils.showToast(`✅ Pendaftaran berhasil! Selamat datang, ${inputs.nama.value}!`, 'success');
      }
      
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
    }, 1500);
  });
});