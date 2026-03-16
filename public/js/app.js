/* ProBooks Accounting — Shared Client-Side Utilities */

/**
 * Toggle password field visibility.
 * Called from the "Show Password" checkbox in _loginEditor.ejs.
 */
function togglePasswordVisibility() {
  const field = document.getElementById('password');
  const icon = document.getElementById('eyeIcon');
  if (!field) return;
  const isHidden = field.type === 'password';
  field.type = isHidden ? 'text' : 'password';
  if (icon) {
    icon.className = isHidden ? 'bi bi-eye-slash' : 'bi bi-eye';
  }
}

/**
 * Auto-dismiss Bootstrap flash alerts after a delay.
 * Targets all elements with the class .pb-flash.
 */
document.addEventListener('DOMContentLoaded', function () {
  const alerts = document.querySelectorAll('.pb-flash');
  alerts.forEach(function (alert) {
    setTimeout(function () {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
      bsAlert.close();
    }, 4000);
  });
});
