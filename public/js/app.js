document.addEventListener('keydown', e => {
  const detailOverlay = document.getElementById('detail-overlay');
  const isDetailOpen = detailOverlay.classList.contains('open');

  if (e.key === 'Escape' && isDetailOpen) {
    closeDetailModal();
  }

  if (!isDetailOpen) return;

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navigateDetail(-1);
  }

  if (e.key === 'ArrowRight') {
    e.preventDefault();
    navigateDetail(1);
  }
});

window.onload = () => {
  // Token não é persistido entre sessões — usuário precisa fazer login ao recarregar.
};

async function carregarVersaoApp() {
  try {
    const resp = await fetch('/api/version');
    const data = await resp.json();

    const el = document.getElementById('app-version');
    if (el) {
      el.textContent = `v${data.version || '1.0.0'}`;
    }
  } catch (error) {
    console.warn('Não foi possível carregar a versão do app:', error);

    const el = document.getElementById('app-version');
    if (el) {
      el.textContent = 'v—';
    }
  }
}

carregarVersaoApp();

function aplicarTemaSalvo() {
  const temaSalvo = localStorage.getItem('dashboard_theme') || 'dark';
  const btn = document.getElementById('theme-toggle');

  if (temaSalvo === 'light') {
    document.body.classList.add('light-theme');

    if (btn) {
      btn.textContent = '☀️ Claro';
    }
  } else {
    document.body.classList.remove('light-theme');

    if (btn) {
      btn.textContent = '🌙 Escuro';
    }
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  const btn = document.getElementById('theme-toggle');

  if (isLight) {
    localStorage.setItem('dashboard_theme', 'light');

    if (btn) {
      btn.textContent = '☀️ Claro';
    }
  } else {
    localStorage.setItem('dashboard_theme', 'dark');

    if (btn) {
      btn.textContent = '🌙 Escuro';
    }
  }
}

aplicarTemaSalvo();