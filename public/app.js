(function () {
  var form = document.getElementById('form-pengaduan');
  var btn = document.getElementById('btn-kirim');
  var btnText = btn.querySelector('.btn-text');
  var msg = document.getElementById('form-message');
  var MAX_MB = 10;

  function show(text, type) {
    msg.textContent = text;
    msg.className = 'message ' + type;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.className = 'message';

    // Validasi bawaan browser untuk field wajib
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var file = document.getElementById('f-bukti').files[0];
    if (file && file.size > MAX_MB * 1024 * 1024) {
      show('Ukuran file maksimal ' + MAX_MB + ' MB.', 'error');
      return;
    }

    btn.disabled = true;
    btnText.textContent = 'Mengirim...';

    fetch('/api/pengaduan', { method: 'POST', body: new FormData(form) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) {
        if (res.ok) {
          form.reset();
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
})();
