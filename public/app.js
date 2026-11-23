(function () {
  var form = document.getElementById('form-pengaduan');
  var btn = document.getElementById('btn-kirim');
  var btnText = btn.querySelector('.btn-text');
  var msg = document.getElementById('form-message');
  var fileInput = document.getElementById('f-bukti');
  var dropzone = document.getElementById('dropzone');
  var dzFile = document.getElementById('dz-file');
  var MAX_MB = 4;

  function show(text, type) {
    msg.textContent = text;
    msg.className = 'message ' + type;
    msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Tampilkan nama file yang dipilih
  function updateFile() {
    var f = fileInput.files[0];
    if (f) {
      dzFile.textContent = '✓ ' + f.name + ' (' + (f.size / 1024 / 1024).toFixed(2) + ' MB)';
      dzFile.hidden = false;
      dropzone.classList.add('has-file');
    } else {
      dzFile.hidden = true;
      dropzone.classList.remove('has-file');
    }
  }
  fileInput.addEventListener('change', updateFile);

  // Efek drag & drop di laptop/desktop
  ['dragenter', 'dragover'].forEach(function (ev) {
    dropzone.addEventListener(ev, function () { dropzone.classList.add('drag'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dropzone.addEventListener(ev, function () { dropzone.classList.remove('drag'); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.className = 'message';

    // Validasi bawaan browser untuk field wajib
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var file = fileInput.files[0];
    if (file && file.size > MAX_MB * 1024 * 1024) {
      show('Ukuran file maksimal ' + MAX_MB + ' MB. Silakan pilih file yang lebih kecil.', 'error');
      return;
    }

    btn.disabled = true;
    btnText.textContent = 'Mengirim...';

    fetch('/api/pengaduan', { method: 'POST', body: new FormData(form) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) {
        if (res.ok) {
          form.reset();
          updateFile();
          show(res.message || 'Pengaduan berhasil dikirim.', 'success');
        } else {
          show(res.message || 'Terjadi kesalahan, silakan coba lagi.', 'error');
        }
      })
      .catch(function () {
        show('Koneksi gagal, silakan coba lagi.', 'error');
      })
      .finally(function () {
        btn.disabled = false;
        btnText.textContent = 'Kirim';
      });
  });

  // Modal Contoh Pengaduan
  var modal = document.getElementById('modal-contoh');
  var btnContoh = document.getElementById('btn-contoh');
  var btnCloseModal = document.getElementById('modal-close-btn');
  var btnCloseFooter = document.getElementById('modal-close-footer');
  var backdrop = document.getElementById('modal-backdrop');

  function openModal() {
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (btnContoh) btnContoh.addEventListener('click', openModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      closeModal();
    }
  });
})();
