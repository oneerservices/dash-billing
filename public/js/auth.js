function signIn() {
  if (!validarConfiguracao()) return;

  const client = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    callback: (resp) => {
      if (resp.access_token) {
        accessToken = resp.access_token;
        sessionStorage.setItem('google_token', accessToken);
        showDashboard(resp);
      }
    }
  });
  client.requestAccessToken();
}

function showDashboard(resp) {
  loggedIn = true;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('btn-refresh').style.display = 'flex';

  fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  }).then(r => r.json()).then(user => {
    const area = document.getElementById('user-area');
    const inicial = (user.name || 'U').charAt(0).toUpperCase();
    area.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <div class="user-chip">
          <div class="user-avatar">
            ${user.picture ? `<img src="${user.picture}" onerror="this.parentElement.textContent='${inicial}'">` : inicial}
          </div>
          <div style="display:flex;flex-direction:column;line-height:1.3;">
            <span style="font-size:13px;font-weight:500;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user.name || 'Usuário'}</span>
            <span style="font-size:11px;color:var(--muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user.email || ''}</span>
          </div>
        </div>
        <button class="btn-logout" onclick="signOut()">Sair</button>
      </div>`;
  }).catch(() => {
    document.getElementById('user-area').innerHTML =
      `<button class="btn-logout" onclick="signOut()">Sair</button>`;
  });

  loadSheetData();
}

function signOut() {
  sessionStorage.removeItem('google_token');
  loggedIn = false;
  document.getElementById('bottom-bar').classList.remove('visible');
  detailCache = null;

  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      location.reload();
    });
  } else {
    location.reload();
  }
}
