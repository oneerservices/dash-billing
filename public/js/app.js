document.getElementById('empty-state').style.display = 'block';
}

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
  const savedToken = sessionStorage.getItem('google_token');
  if (savedToken) {
    accessToken = savedToken;
    showDashboard();
  }
};
