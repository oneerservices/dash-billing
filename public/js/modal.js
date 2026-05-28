async function openModal() {
  const selected = allRows.filter(r => selectedIds.has(r.id));
  if (!selected.length) return;

  document.getElementById('modal').classList.add('open');
  document.getElementById('progress-list').innerHTML = '';
  document.getElementById('progress-bar').style.width = '0%';
  document.getElementById('btn-fechar').style.display = 'none';
  document.getElementById('btn-disparar').disabled = true;

  const total = selected.length;
  const intervaloSeg = Math.round(INTERVALO_MS / 1000);
  document.getElementById('modal-sub').textContent =
    `Disparando ${total} cobranças com ${intervaloSeg}s de intervalo (~${Math.round(total * intervaloSeg / 60)} min no total)`;

  let ok = 0, erros = 0;

  for (let i = 0; i < selected.length; i++) {
    const cliente = selected[i];
    const pct = Math.round((i / total) * 100);
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('progress-status').textContent =
      `Enviando ${i + 1} de ${total} — aguardando ${intervaloSeg}s...`;

    addProgressItem('⏳', `${cliente.nome}...`);

    try {
      const resp = await fetch(API_COBRANCAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: cliente.nome,
          valor: cliente.valor,
          faturas: cliente.faturas,
          vencimento: cliente.data,
          status: cliente.status
        })
      });

      if (resp.ok) { ok++; updateLastProgressItem('✅', `${cliente.nome} — enviado`); }
      else { erros++; updateLastProgressItem('❌', `${cliente.nome} — erro ${resp.status}`); }
    } catch (e) {
      erros++;
      updateLastProgressItem('❌', `${cliente.nome} — falha de conexão`);
    }

    if (i < selected.length - 1) await sleep(INTERVALO_MS);
  }

  document.getElementById('progress-bar').style.width = '100%';
  document.getElementById('progress-status').textContent =
    `✅ Concluído! ${ok} enviados${erros > 0 ? ` · ${erros} erros` : ''}`;
  document.getElementById('btn-fechar').style.display = 'block';
  document.getElementById('btn-disparar').disabled = false;
}

function addProgressItem(icon, text) {
  const list = document.getElementById('progress-list');
  const div = document.createElement('div');
  div.className = 'progress-item';
  div.innerHTML = `<span class="progress-icon">${icon}</span><span>${text}</span>`;
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
}

function updateLastProgressItem(icon, text) {
  const items = document.querySelectorAll('.progress-item');
  if (items.length > 0) {
    const last = items[items.length - 1];
    last.querySelector('.progress-icon').textContent = icon;
    last.querySelector('span:last-child').textContent = text;
  }
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  clearSelection();
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function showEmpty() {
