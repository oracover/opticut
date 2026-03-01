/* =============================================================
   OptiCut — JavaScript partagé : utilitaires, header, modales,
   import/export, algorithmes guillotine (tôle) et FFD (barre),
   rendu canvas, persistance localStorage.

   Chargé sur les pages app (tole.html, barre.html).
   Dépendance externe : jsPDF (chargé avant ce script).
   ============================================================= */

'use strict';

/* =============================================================
   1. CONSTANTES GLOBALES
   ============================================================= */

/** Palette de couleurs cyclée lors des ajouts successifs */
const COLORS = [
  '#3ecfcf','#f5a623','#52c97a','#e05252',
  '#a78bfa','#f472b6','#fb923c','#34d399','#60a5fa','#fbbf24'
];

/** Matières disponibles dans les menus déroulants */
const MATERIALS = ['Acier','Inox','Aluminium','Galva','Laiton','Cuivre','Autre'];

/** Clé localStorage — changer la version pour invalider l'ancien cache */
const STORAGE_KEY = 'opticut_v2';

/* =============================================================
   2. UTILITAIRES PARTAGÉS
   ============================================================= */

/** Échappe HTML pour éviter les injections dans innerHTML */
const esc = s => String(s)
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/"/g,'&quot;');

/** Classe CSS selon taux (≥80 bon, ≥60 moyen, <60 mauvais) */
const rateClass = r => r >= 80 ? 'good' : r >= 60 ? 'warn' : 'bad';

/**
 * Couleur CSS selon taux d'utilisation.
 * Retourne une variable CSS (résolue dans le contexte page).
 */
const rateColor = r =>
  r >= 80 ? 'var(--green)' : r >= 60 ? 'var(--accent)' : 'var(--danger)';

/**
 * Affiche un toast de notification (3,2 s).
 * @param {string} msg  - Message à afficher
 * @param {'success'|'error'} type - Style du toast
 */
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

/**
 * Incrémente la lettre finale d'un champ texte (ex: "Panneau A" → "Panneau B").
 * S'arrête à Z puis repart à A.
 */
function autoNextName(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const m = input.value.match(/^(.*?)([A-Z])$/);
  if (m) {
    const next = String.fromCharCode(m[2].charCodeAt(0) + 1);
    input.value = m[1] + (next <= 'Z' ? next : 'A');
  }
}

/**
 * Passe à la couleur suivante dans la palette et met à jour l'input color.
 * @param {string}     inputId - id de l'<input type="color">
 * @param {{v:number}} idxRef  - référence partagée de l'index courant
 */
function nextColor(inputId, idxRef) {
  idxRef.v = (idxRef.v + 1) % COLORS.length;
  const el = document.getElementById(inputId);
  if (el) el.value = COLORS[idxRef.v];
}

/**
 * Met à jour le badge "×utilisé/stock" d'une ligne tableau.
 * @param {string} elId  - id de la cellule TD
 * @param {number} used  - quantité utilisée
 * @param {number} stock - stock total
 */
function renderUsedBadge(elId, used, stock) {
  const el = document.getElementById(elId);
  if (!el) return;
  const cls = used === 0 ? '' : used >= stock ? 'full' : 'ok';
  el.innerHTML = `<span class="badge ${cls}">×${used}/${stock}</span>`;
}

/**
 * Remet à zéro un ensemble de cellules statistiques.
 * @param {string[]} statIds - ids des éléments à vider
 * @param {string}   barId   - id de la barre de progression
 */
function clearStats(statIds, barId) {
  statIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = '—'; el.className = 'stat-val'; }
  });
  const bar = document.getElementById(barId);
  if (bar) bar.style.width = '0%';
}

/**
 * Télécharge un Blob sous forme de fichier.
 * @param {Blob}   blob     - Données à télécharger
 * @param {string} filename - Nom de fichier proposé
 */
function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/** Peupler tous les <select> de matières présents sur la page */
function initMaterialSelects() {
  document.querySelectorAll('#tole_pMaterial, #tole_sMaterial').forEach(sel => {
    sel.innerHTML = MATERIALS.map(m => `<option>${m}</option>`).join('');
  });
}

/* =============================================================
   3. NAVIGATION HEADER — panneau déroulant ☰
   ============================================================= */

let _panelOpen = false;

/** Bascule le panneau Import/Export/Reset */
function togglePanel() {
  _panelOpen = !_panelOpen;
  const panel  = document.getElementById('hdrPanel');
  const toggle = document.getElementById('hdrToggle');
  if (panel)  panel.classList.toggle('open', _panelOpen);
  if (toggle) toggle.classList.toggle('open', _panelOpen);
}

/** Ferme le panneau programmatiquement */
function closePanel() {
  _panelOpen = false;
  document.getElementById('hdrPanel')?.classList.remove('open');
  document.getElementById('hdrToggle')?.classList.remove('open');
}

/* =============================================================
   4. MODALES — Import CSV et Coller depuis tableur
   ============================================================= */

/** Ouvre une modale (ajoute la classe .open) */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }

/** Ferme une modale (retire la classe .open) */
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

/** Ouvre la modale d'import CSV */
function showImportCSV()  { openModal('modalImportCSV'); }

/** Ouvre la modale Coller depuis tableur */
function showPasteModal() { openModal('modalPaste'); }

/** Vide la zone de texte de collage */
function clearPasteArea() {
  const el = document.getElementById('pasteArea');
  if (el) el.value = '';
}

/** Initialise la fermeture des modales en cliquant sur l'overlay */
function initModals() {
  document.querySelectorAll('.modal-overlay').forEach(ov =>
    ov.addEventListener('click', e => {
      if (e.target === ov) ov.classList.remove('open');
    })
  );
}

/* =============================================================
   5. EXPORT — PDF / JPEG / PNG / CSV
   ============================================================= */

/**
 * Point d'entrée pour tous les exports.
 * Détecte l'onglet actif et dispatch vers tôle ou barre.
 * @param {'pdf'|'jpeg'|'png'|'csv'} fmt
 */
function activeExport(fmt) {
  // Sur la page tole.html, toujours tôle.
  // Sur la page barre.html, toujours barre.
  const isTolePage  = typeof tole_results !== 'undefined';
  const isBarrePage = typeof b_results    !== 'undefined';

  // Fallback : détecter l'onglet actif si les deux modules sont présents
  const activeTab = document.querySelector('.hdr-tab.active')?.id;
  const isTole = isTolePage && (activeTab === 'tab-tole-btn' || !isBarrePage);

  if (fmt === 'csv') {
    if (isTole) tole_exportCSV();
    else        barre_exportCSV();
    return;
  }

  if (isTole) {
    const cvs = tole_results.map((rs, i) =>
      tole_renderSheetToCanvas(rs, i, tole_results.length));
    exportCanvases(fmt, cvs, 'opticut_tole', 'tôle(s)');
  } else {
    const kerf   = parseFloat(document.getElementById('b_kerf')?.value)   || 3;
    const profil = parseFloat(document.getElementById('b_profil')?.value) || 50;
    const cvs = b_results.map((ob, i) =>
      barre_renderBarToCanvas(ob, i, b_results.length, kerf, profil));
    exportCanvases(fmt, cvs, 'opticut_barre', 'barre(s)');
  }
}

/**
 * Exporte un tableau de canvas en PDF (2/page A4), JPEG ou PNG.
 * @param {'pdf'|'jpeg'|'png'} fmt
 * @param {HTMLCanvasElement[]} canvases
 * @param {string} baseName - Préfixe du nom de fichier
 * @param {string} unit     - Unité pour le toast ("tôle(s)")
 */
async function exportCanvases(fmt, canvases, baseName, unit) {
  if (!canvases.length) {
    toast("Lancez d'abord une optimisation !", 'error');
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  toast(`Génération ${fmt.toUpperCase()}…`);

  if (fmt === 'pdf') {
    // ── Export PDF — 2 plans par page A4 portrait ──
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    canvases.forEach((cv, i) => {
      const img  = cv.toDataURL('image/jpeg', 0.92);
      const slot = i % 2; // 0 = haut, 1 = bas
      if (i > 0 && slot === 0) doc.addPage();
      doc.addImage(img, 'JPEG', 0, slot * 148.5, 210, 148.5);
      if (slot === 0 && i < canvases.length - 1) {
        doc.setDrawColor(200, 210, 220);
        doc.setLineWidth(0.3);
        doc.line(10, 148.5, 200, 148.5);
      }
    });
    doc.save(`${baseName}_${date}.pdf`);
    toast(`PDF exporté — ${canvases.length} ${unit} ✓`);

  } else if (fmt === 'jpeg') {
    canvases.forEach((cv, i) => {
      const a = document.createElement('a');
      a.download = `${baseName}_${String(i+1).padStart(2,'0')}_${date}.jpg`;
      a.href = cv.toDataURL('image/jpeg', 0.93);
      a.click();
    });
    toast(`${canvases.length} JPEG exporté(s) ✓`);

  } else if (fmt === 'png') {
    canvases.forEach((cv, i) => {
      const a = document.createElement('a');
      a.download = `${baseName}_${String(i+1).padStart(2,'0')}_${date}.png`;
      a.href = cv.toDataURL('image/png');
      a.click();
    });
    toast(`${canvases.length} PNG exporté(s) ✓`);
  }
}

/* ── Export CSV ─────────────────────────────────────────────── */

/** Exporte panneaux + tôles mères au format CSV UTF-8 (BOM inclus) */
function tole_exportCSV() {
  const rows = [['type','name','w','h','thick','material','qty','color','rotate']];
  tole_pieces.forEach(p =>
    rows.push(['piece', p.name, p.w, p.h, p.thick, p.material, p.qty, p.color, p.rotate ? '1' : '0']));
  // Pour les tôles, la col qty = stock et col color = kerf (ordre fixé par l'import)
  tole_sheets.forEach(s =>
    rows.push(['sheet', s.name, s.w, s.h, s.thick, s.material, s.stock, s.kerf || 0, '']));
  const csv = rows.map(r =>
    r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadBlob(
    new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
    `opticut_tole_${new Date().toISOString().slice(0,10)}.csv`
  );
  toast('CSV tôle exporté ✓');
}

/** Exporte barres mères + pièces à débiter au format CSV */
function barre_exportCSV() {
  const rows = [['type','name','len_or_lenHT','stock_or_angL','angR','qty','color']];
  b_bars.forEach(b =>
    rows.push(['bar', b.name, b.len, b.stock, '', '', '']));
  b_pieces.forEach(p =>
    rows.push(['bpiece', p.name, p.lenHT, p.angL, p.angR, p.qty, p.color]));
  const csv = rows.map(r =>
    r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadBlob(
    new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
    `opticut_barre_${new Date().toISOString().slice(0,10)}.csv`
  );
  toast('CSV barre exporté ✓');
}

/* ── Import CSV ─────────────────────────────────────────────── */

/**
 * Lit et parse un fichier CSV OptiCut.
 * Gère le BOM UTF-8 et les délimiteurs , et ;.
 * @param {Event} e - Événement onchange de l'<input type="file">
 */
function importCSV(e) {
  const file = e.target.files[0];
  if (!file) return;
  const filenameEl = document.getElementById('csv_filename');
  if (filenameEl) filenameEl.textContent = file.name;

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      // Retirer le BOM UTF-8 si présent
      const text   = ev.target.result.replace(/^\uFEFF/, '');
      const lines  = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const delim  = lines[0].includes(';') ? ';' : ',';
      const parseRow = l =>
        l.split(delim).map(v => v.replace(/^"|"$/g,'').replace(/""/g,'"').trim());

      const rows    = lines.map(parseRow);
      const header  = rows[0].map(h => h.toLowerCase());
      const data    = rows.slice(1);
      const typeIdx = header.indexOf('type');

      if (typeIdx === -1) {
        toast('Colonne "type" manquante dans le CSV', 'error');
        return;
      }

      let tPieces = 0, tSheets = 0, tBars = 0, tBPieces = 0;

      data.forEach(r => {
        const type = r[typeIdx]?.toLowerCase();

        if (type === 'piece') {
          tole_pieces.push({
            id: ++tole_pieceId,
            name:     r[header.indexOf('name')]     || 'Panneau',
            w:        parseFloat(r[header.indexOf('w')])     || 100,
            h:        parseFloat(r[header.indexOf('h')])     || 100,
            thick:    parseFloat(r[header.indexOf('thick')]) || 1,
            material: r[header.indexOf('material')]  || 'Acier',
            qty:      parseInt(r[header.indexOf('qty')]) || 1,
            color:    r[header.indexOf('color')]     || COLORS[tole_colorIdx.v % COLORS.length],
            rotate:   r[header.indexOf('rotate')]   !== '0'
          }); tPieces++;

        } else if (type === 'sheet') {
          tole_sheets.push({
            id: ++tole_sheetId,
            name:     r[header.indexOf('name')]     || 'Tôle',
            w:        parseFloat(r[header.indexOf('w')])     || 1000,
            h:        parseFloat(r[header.indexOf('h')])     || 500,
            thick:    parseFloat(r[header.indexOf('thick')]) || 1,
            material: r[header.indexOf('material')]  || 'Acier',
            // colonne qty → stock ; colonne color → kerf (format exporté)
            stock: parseInt(r[header.indexOf('qty')])    || 1,
            kerf:  parseFloat(r[header.indexOf('color')]) || 0,
            used:  0
          }); tSheets++;

        } else if (type === 'bar') {
          b_bars.push({
            id:    ++b_barId,
            name:  r[header.indexOf('name')]              || 'Barre',
            len:   parseFloat(r[header.indexOf('len_or_lenht')])   || 6000,
            stock: parseInt(r[header.indexOf('stock_or_angl')]) || 1,
            used:  0
          }); tBars++;

        } else if (type === 'bpiece') {
          b_pieces.push({
            id:    ++b_pieceId,
            name:  r[header.indexOf('name')]  || 'Pièce',
            lenHT: parseFloat(r[header.indexOf('len_or_lenht')])   || 1000,
            angL:  parseFloat(r[header.indexOf('stock_or_angl')]) || 0,
            angR:  parseFloat(r[header.indexOf('angr')])  || 0,
            qty:   parseInt(r[header.indexOf('qty')]) || 1,
            color: r[header.indexOf('color')] || COLORS[b_colorIdx.v % COLORS.length]
          }); tBPieces++;
        }
      });

      // Rafraîchir les tableaux présents sur la page courante
      if (typeof tole_renderPieces === 'function') tole_renderPieces();
      if (typeof tole_renderSheets === 'function') tole_renderSheets();
      if (typeof barre_renderBars  === 'function') barre_renderBars();
      if (typeof barre_renderPieces=== 'function') barre_renderPieces();

      closeModal('modalImportCSV');
      toast(`Importé : ${tPieces} panneaux, ${tSheets} tôles, ${tBars} barres, ${tBPieces} pièces ✓`);

    } catch (err) {
      toast('Erreur lecture CSV : ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
  e.target.value = ''; // permet de réimporter le même fichier
}

/* ── Coller depuis tableur Excel / LibreOffice ──────────────── */

/**
 * Parse les données collées depuis un tableur.
 * Délimiteur auto-détecté : tabulation (Excel) ou point-virgule.
 * @param {'tole_pieces'|'tole_sheets'|'barre_bars'|'barre_pieces'} target
 */
function parsePaste() {
  const raw    = document.getElementById('pasteArea')?.value.trim();
  const target = document.getElementById('pasteTarget')?.value;
  if (!raw)    { toast('Zone de collage vide', 'error'); return; }
  if (!target) return;

  const delim = raw.includes('\t') ? '\t' : ';';
  const lines  = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows   = lines.map(l =>
    l.split(delim).map(c => c.trim().replace(/^["']|["']$/g, ''))
  );
  let count = 0;

  try {
    if (target === 'tole_pieces') {
      // Colonnes : Nom · Largeur · Hauteur · Épaisseur · Matière · Qté
      rows.forEach(r => {
        const w = parseFloat(r[1]), h = parseFloat(r[2]);
        if (!r[0] || !w || !h) return;
        tole_pieces.push({
          id: ++tole_pieceId, name: r[0], w, h,
          thick:    parseFloat(r[3]) || 1,
          material: MATERIALS.includes(r[4]) ? r[4] : 'Acier',
          qty:      parseInt(r[5]) || 1,
          color:    COLORS[tole_colorIdx.v % COLORS.length],
          rotate:   true
        });
        tole_colorIdx.v = (tole_colorIdx.v + 1) % COLORS.length;
        count++;
      });
      tole_renderPieces();

    } else if (target === 'tole_sheets') {
      // Colonnes : Désignation · Largeur · Hauteur · Épaisseur · Matière · Stock · Jeu
      rows.forEach(r => {
        const w = parseFloat(r[1]), h = parseFloat(r[2]);
        if (!r[0] || !w || !h) return;
        tole_sheets.push({
          id: ++tole_sheetId, name: r[0], w, h,
          thick:    parseFloat(r[3]) || 1,
          material: MATERIALS.includes(r[4]) ? r[4] : 'Acier',
          stock:    parseInt(r[5]) || 1,
          kerf:     parseFloat(r[6]) || 3,
          used:     0
        });
        count++;
      });
      tole_renderSheets();
      tole_renderPieces(); // met à jour les badges ⚠

    } else if (target === 'barre_bars') {
      // Colonnes : Nom · Longueur · Stock
      rows.forEach(r => {
        const len = parseFloat(r[1]);
        if (!r[0] || !len) return;
        b_bars.push({ id: ++b_barId, name: r[0], len, stock: parseInt(r[2]) || 1, used: 0 });
        count++;
      });
      barre_renderBars();

    } else if (target === 'barre_pieces') {
      // Colonnes : Nom · Long. HT · Angle G · Angle D · Qté
      rows.forEach(r => {
        const lenHT = parseFloat(r[1]);
        if (!r[0] || !lenHT) return;
        b_pieces.push({
          id: ++b_pieceId, name: r[0], lenHT,
          angL:  parseFloat(r[2]) || 0,
          angR:  parseFloat(r[3]) || 0,
          qty:   parseInt(r[4]) || 1,
          color: COLORS[b_colorIdx.v % COLORS.length]
        });
        b_colorIdx.v = (b_colorIdx.v + 1) % COLORS.length;
        count++;
      });
      barre_renderPieces();
    }

    if (count > 0) {
      closeModal('modalPaste');
      toast(`${count} ligne(s) importée(s) ✓`);
    } else {
      toast('Aucune ligne reconnue — vérifiez le format', 'error');
    }

  } catch (err) {
    toast('Erreur parsing : ' + err.message, 'error');
  }
}

/* =============================================================
   6. HELPERS CANVAS HAUTE RÉSOLUTION (pour PDF / JPEG / PNG)
   Canvas de travail : 2480 × 1754 px (≈ A4 paysage @300 dpi)
   ============================================================= */

/**
 * Dessine l'en-tête OptiCut sur un canvas d'export.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} PW       - Largeur totale du canvas
 * @param {number} MARGIN   - Marge gauche/droite
 * @param {number} HEADER_H - Hauteur de la zone d'en-tête
 * @param {string} right1   - Titre à droite (ex: "Tôle 1/3 — Standard")
 * @param {string} right2   - Sous-titre à droite (dimensions, matière…)
 */
function pdfDrawHeader(ctx, PW, MARGIN, HEADER_H, right1, right2) {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, PW, HEADER_H);
  ctx.fillStyle = '#f5a623';
  ctx.font = 'bold 52px Arial';
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText('OPTICUT', MARGIN, HEADER_H / 2);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px Arial'; ctx.textAlign = 'right';
  ctx.fillText(right1, PW - MARGIN, HEADER_H * 0.38);
  ctx.font = '26px Arial'; ctx.fillStyle = '#aabbcc';
  ctx.fillText(right2, PW - MARGIN, HEADER_H * 0.72);
}

/**
 * Dessine un tableau de données tabulaires sur le canvas d'export.
 * La 2e colonne est élargie automatiquement pour remplir tW.
 * @returns {number} ordonnée Y après le bas du tableau
 */
function pdfDrawTable(ctx, tX, tY, tW, cols, colW, rows, ROW_H = 52, HDR_H = 58) {
  colW[1] += tW - colW.reduce((a, b) => a + b, 0); // ajuster largeur col 2

  // En-tête
  ctx.fillStyle = '#1a1a2e'; ctx.fillRect(tX, tY, tW, HDR_H);
  ctx.fillStyle = '#7a8fa8'; ctx.font = 'bold 24px Arial'; ctx.textBaseline = 'middle';
  let cx = tX + 8;
  cols.forEach((c, i) => {
    ctx.textAlign = i === 0 ? 'center' : 'left';
    ctx.fillText(c, cx + (i === 0 ? colW[i] / 2 : 4), tY + HDR_H / 2);
    cx += colW[i];
  });

  // Lignes de données
  rows.forEach(({ color, vals }, i) => {
    const ry = tY + HDR_H + i * ROW_H;
    ctx.fillStyle = i % 2 === 0 ? '#f7f8fa' : '#eef0f4';
    ctx.fillRect(tX, ry, tW, ROW_H);
    if (color) { ctx.fillStyle = color; ctx.fillRect(tX + colW[0] + 6, ry + 11, 18, ROW_H - 22); }
    ctx.fillStyle = '#1a1a2e'; ctx.font = '22px Arial'; ctx.textBaseline = 'middle';
    let vx = tX + 8;
    vals.forEach((v, j) => {
      ctx.textAlign = j === 0 ? 'center' : 'left';
      ctx.fillText(String(v), j === 1 ? vx + 30 : vx + 4, ry + ROW_H / 2);
      vx += colW[j];
    });
    ctx.strokeStyle = '#d0d5dc'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tX, ry + ROW_H); ctx.lineTo(tX + tW, ry + ROW_H); ctx.stroke();
  });

  // Séparateurs de colonnes
  ctx.strokeStyle = '#c8cdd6'; ctx.lineWidth = 1;
  let sx = tX;
  colW.forEach(w => {
    sx += w;
    ctx.beginPath(); ctx.moveTo(sx, tY); ctx.lineTo(sx, tY + HDR_H + rows.length * ROW_H); ctx.stroke();
  });

  return tY + HDR_H + rows.length * ROW_H;
}

/** Dessine le pied de page (ligne + date) */
function pdfDrawFooter(ctx, PW, PH, MARGIN, FOOTER_H) {
  ctx.strokeStyle = '#dde2ea'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, PH - FOOTER_H); ctx.lineTo(PW, PH - FOOTER_H); ctx.stroke();
  ctx.fillStyle = '#99a8bb'; ctx.font = '20px Arial';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(`OptiCut — ${new Date().toLocaleDateString('fr-FR')}`, PW - MARGIN, PH - FOOTER_H / 2);
}

/** Trace un chemin de rectangle aux coins arrondis (sans stroke/fill) */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* =============================================================
   7. MODULE TÔLE — données & algorithme
   ============================================================= */

// ── État ──
let tole_pieces   = [];  // panneaux à découper
let tole_sheets   = [];  // tôles mères disponibles
let tole_results  = [];  // résultats du dernier calepinage (pour export)
let tole_pieceId  = 0;
let tole_sheetId  = 0;
let tole_colorIdx = { v: 0 };
let tole_mode     = 'surface'; // 'surface' | 'coupes'

/* ── Mode d'optimisation ── */

/**
 * Bascule entre les modes "Max Surface" (guillotine) et "Min Coupes" (bandes).
 * @param {'surface'|'coupes'} mode
 */
function tole_setMode(mode) {
  tole_mode = mode;
  document.getElementById('modeSurface')?.classList.toggle('active', mode === 'surface');
  document.getElementById('modeCoupe')?.classList.toggle('active', mode === 'coupes');
  const badge = document.getElementById('algoBadge');
  if (badge) {
    badge.textContent = mode === 'surface' ? 'GUILLOTINE' : 'MIN COUPES';
    badge.className   = mode === 'surface' ? 'algo-badge' : 'algo-badge mode-coupes';
  }
  persist_save();
}

/* ── Reset ── */
function tole_resetPieces() {
  if (!tole_pieces.length || !confirm('Vider tous les panneaux ?')) return;
  tole_pieces = []; tole_renderPieces(); toast('Panneaux réinitialisés');
}
function tole_resetAll() {
  if (!confirm('Tout réinitialiser (module tôle) ?')) return;
  tole_pieces = []; tole_sheets = []; tole_results = [];
  tole_pieceId = tole_sheetId = 0; tole_colorIdx.v = 0;
  tole_renderPieces(); tole_renderSheets(); tole_clearResults();
  toast('Module tôle réinitialisé');
}

/* ── CRUD panneaux ── */
function tole_addPiece() {
  const name     = document.getElementById('tole_pName').value.trim() || 'Panneau';
  const w        = parseFloat(document.getElementById('tole_pW').value);
  const h        = parseFloat(document.getElementById('tole_pH').value);
  const thick    = parseFloat(document.getElementById('tole_pThick').value) || 1;
  const material = document.getElementById('tole_pMaterial').value;
  const qty      = parseInt(document.getElementById('tole_pQty').value);
  const color    = document.getElementById('tole_pColor').value;
  const rotate   = document.getElementById('tole_pRotate').value === 'yes';
  if (!w || !h || !qty) return;
  tole_pieces.push({ id: ++tole_pieceId, name, w, h, thick, material, qty, color, rotate });
  nextColor('tole_pColor', tole_colorIdx);
  autoNextName('tole_pName');
  tole_renderPieces();
}
function tole_removePiece(id) {
  tole_pieces = tole_pieces.filter(p => p.id !== id);
  tole_renderPieces();
}
function tole_updatePiece(id, field, value) {
  const p = tole_pieces.find(p => p.id === id); if (!p) return;
  p[field] = ['w','h','thick','qty'].includes(field)
    ? (parseFloat(value) || p[field]) : value;
  const row = document.getElementById('tole_prow_' + id);
  if (row) {
    const su = row.querySelector('.surf-unit'); if (su) su.textContent = (p.w*p.h/1e6).toFixed(4)+' m²';
    const st = row.querySelector('.surf-tot');  if (st) st.textContent = (p.w*p.h*p.qty/1e6).toFixed(4)+' m²';
  }
  if (field === 'material' || field === 'thick') tole_renderPieces();
  tole_updatePieceSummary();
}
function tole_updatePieceColor(id, value) {
  const p = tole_pieces.find(p => p.id === id); if (!p) return;
  p.color = value;
  const sw = document.querySelector(`#tole_prow_${id} .swatch`);
  if (sw) sw.style.background = value;
}
function tole_updatePieceSummary() {
  const qty = tole_pieces.reduce((s, p) => s + p.qty, 0);
  const m2  = tole_pieces.reduce((s, p) => s + p.w * p.h * p.qty / 1e6, 0);
  const el  = document.getElementById('tole_pieceSummary');
  if (el) el.textContent = `${qty} pièce(s) · ${m2.toFixed(3)} m²`;
}

/** Re-génère le tbody des panneaux */
function tole_renderPieces() {
  const tbody = document.getElementById('tole_pieceBody');
  if (!tbody) return;
  const sheetKeys = new Set(tole_sheets.map(s => `${s.material}|${s.thick}`));
  tbody.innerHTML = !tole_pieces.length
    ? '<tr class="empty-row"><td colspan="10">Aucun panneau — utilisez le formulaire ci-dessus</td></tr>'
    : tole_pieces.map(p => {
        const noSheet = tole_sheets.length > 0 && !sheetKeys.has(`${p.material}|${p.thick}`);
        const warn    = noSheet ? `<span class="mat-warn">⚠ pas de tôle</span>` : '';
        const matOpts = MATERIALS.map(m => `<option${m===p.material?' selected':''}>${m}</option>`).join('');
        return `<tr id="tole_prow_${p.id}">
          <td><div class="name-cell">
            <span class="swatch" style="background:${p.color}"></span>
            <input class="cell-input" style="min-width:80px" value="${esc(p.name)}"
                   onchange="tole_updatePiece(${p.id},'name',this.value)">
            <input type="color" class="cell-color" value="${p.color}"
                   oninput="tole_updatePieceColor(${p.id},this.value)">
          </div></td>
          <td><input class="cell-input" type="number" min="1" value="${p.w}"
                 onchange="tole_updatePiece(${p.id},'w',this.value)"></td>
          <td><input class="cell-input" type="number" min="1" value="${p.h}"
                 onchange="tole_updatePiece(${p.id},'h',this.value)"></td>
          <td><input class="cell-input" type="number" min="0.1" step="0.1" value="${p.thick}"
                 onchange="tole_updatePiece(${p.id},'thick',this.value)"></td>
          <td><select class="cell-select"
                      onchange="tole_updatePiece(${p.id},'material',this.value)">${matOpts}</select>${warn}</td>
          <td><input class="cell-input" type="number" min="1" value="${p.qty}"
                 onchange="tole_updatePiece(${p.id},'qty',this.value)"></td>
          <td class="surf-unit mono">${(p.w*p.h/1e6).toFixed(4)} m²</td>
          <td class="surf-tot  mono">${(p.w*p.h*p.qty/1e6).toFixed(4)} m²</td>
          <td class="center">
            <select class="cell-select" style="width:74px"
                    onchange="tole_updatePiece(${p.id},'rotate',this.value==='yes')">
              <option value="yes"${p.rotate  ? ' selected':''}> ↻ Oui</option>
              <option value="no"${!p.rotate ? ' selected':''}> — Non</option>
            </select>
          </td>
          <td class="center"><button class="btn-del" onclick="tole_removePiece(${p.id})">✕</button></td>
        </tr>`;
      }).join('');
  tole_updatePieceSummary();
  persist_save();
}

/* ── CRUD tôles mères ── */
function tole_addSheet() {
  const name     = document.getElementById('tole_sName').value.trim() || 'Tôle';
  const w        = parseFloat(document.getElementById('tole_sW').value);
  const h        = parseFloat(document.getElementById('tole_sH').value);
  const thick    = parseFloat(document.getElementById('tole_sThick').value) || 1;
  const material = document.getElementById('tole_sMaterial').value;
  const stock    = parseInt(document.getElementById('tole_sStock').value);
  const kerf     = parseFloat(document.getElementById('tole_sKerf').value) || 0;
  if (!w || !h || !stock) return;
  tole_sheets.push({ id: ++tole_sheetId, name, w, h, thick, material, stock, kerf, used: 0 });
  tole_renderSheets();
  tole_renderPieces();
}
function tole_removeSheet(id) {
  tole_sheets = tole_sheets.filter(s => s.id !== id);
  tole_renderSheets();
  tole_renderPieces();
}
function tole_updateSheet(id, field, value) {
  const s = tole_sheets.find(s => s.id === id); if (!s) return;
  s[field] = ['w','h','thick','stock','kerf'].includes(field)
    ? (parseFloat(value) || s[field]) : value;
  const row = document.getElementById('tole_srow_' + id);
  if (row) { const sf = row.querySelector('.ssurf'); if (sf) sf.textContent = (s.w*s.h/1e6).toFixed(4)+' m²'; }
  const sumEl = document.getElementById('tole_sheetSummary');
  if (sumEl) sumEl.textContent = `${tole_sheets.length} format(s)`;
  if (field === 'material' || field === 'thick') tole_renderPieces();
}
function tole_renderSheets() {
  const tbody = document.getElementById('tole_sheetBody'); if (!tbody) return;
  tbody.innerHTML = !tole_sheets.length
    ? '<tr class="empty-row"><td colspan="10">Aucun format — utilisez le formulaire ci-dessus</td></tr>'
    : tole_sheets.map(s => {
        const matOpts = MATERIALS.map(m => `<option${m===s.material?' selected':''}>${m}</option>`).join('');
        return `<tr id="tole_srow_${s.id}">
          <td><input class="cell-input" style="min-width:130px" value="${esc(s.name)}"
                 onchange="tole_updateSheet(${s.id},'name',this.value)"></td>
          <td><input class="cell-input" type="number" min="1" value="${s.w}"
                 onchange="tole_updateSheet(${s.id},'w',this.value)"></td>
          <td><input class="cell-input" type="number" min="1" value="${s.h}"
                 onchange="tole_updateSheet(${s.id},'h',this.value)"></td>
          <td><input class="cell-input" type="number" min="0.1" step="0.1" value="${s.thick}"
                 onchange="tole_updateSheet(${s.id},'thick',this.value)"></td>
          <td><select class="cell-select"
                      onchange="tole_updateSheet(${s.id},'material',this.value)">${matOpts}</select></td>
          <td class="ssurf mono">${(s.w*s.h/1e6).toFixed(4)} m²</td>
          <td><input class="cell-input" type="number" min="0" step="0.5" value="${s.kerf}"
                 onchange="tole_updateSheet(${s.id},'kerf',this.value)"></td>
          <td><input class="cell-input" type="number" min="1" value="${s.stock}"
                 onchange="tole_updateSheet(${s.id},'stock',this.value)"></td>
          <td class="center" id="tole_used_${s.id}"><span class="badge">—</span></td>
          <td class="center"><button class="btn-del" onclick="tole_removeSheet(${s.id})">✕</button></td>
        </tr>`;
      }).join('');
  const sumEl = document.getElementById('tole_sheetSummary');
  if (sumEl) sumEl.textContent = `${tole_sheets.length} format(s)`;
  persist_save();
}

/* ── Algorithme principal Tôle ── */

/**
 * Lance le calepinage 2D.
 * Groupe les pièces par matière+épaisseur, applique l'algorithme
 * guillotine récursif sur chaque groupe en choisissant la meilleure tôle.
 */
function tole_optimize() {
  if (!tole_pieces.length) { toast('Section 1 : ajoutez des panneaux !', 'error'); return; }
  if (!tole_sheets.length) { toast('Section 2 : ajoutez des tôles mères !', 'error'); return; }

  // Vérifier la compatibilité matière+épaisseur
  const sheetKeys = new Set(tole_sheets.map(s => `${s.material}|${s.thick}`));
  const missing   = [...new Set(tole_pieces.map(p => `${p.material}|${p.thick}`))].filter(k => !sheetKeys.has(k));
  if (missing.length) {
    toast(`Aucune tôle pour : ${missing.map(k => { const [m,e]=k.split('|'); return `${m} ${e}mm`; }).join(' · ')}`, 'error');
    return;
  }

  // Développer les quantités (1 objet = 1 instance physique)
  let allItems = [];
  tole_pieces.forEach(p => {
    for (let i = 0; i < p.qty; i++) allItems.push({ ...p, uid: `${p.id}_${i}` });
  });

  // Regrouper par matière+épaisseur
  const groups = {};
  allItems.forEach(item => {
    const k = `${item.material}|${item.thick}`;
    (groups[k] || (groups[k] = [])).push(item);
  });

  tole_sheets.forEach(s => s.used = 0);
  const results = [], warnings = [];

  for (const [key, groupItems] of Object.entries(groups)) {
    const [material, thickStr] = key.split('|');
    const thick  = parseFloat(thickStr);
    const compat = tole_sheets.filter(s => s.material === material && s.thick === thick);
    // Trier par surface décroissante (meilleures pièces en premier)
    let items = [...groupItems].sort((a, b) => b.w * b.h - a.w * a.h);

    while (items.length > 0) {
      let bestPlaced = null, bestType = null, bestScore = -Infinity, bestCuts = 0, bestCutLines = [];

      for (const st of compat) {
        if (st.used >= st.stock) continue;
        const res = tole_mode === 'surface'
          ? packGuillotineMaxSurface(items, st.w, st.h, st.kerf)
          : packGuillotineMinCuts(items, st.w, st.h, st.kerf);
        if (!res.placed.length) continue;
        const score = tole_mode === 'surface'
          ? res.placed.reduce((s, p) => s + p.pw * p.ph, 0) / (st.w * st.h)
          : res.placed.length * 10000 - res.cutsCount;
        if (score > bestScore) {
          bestScore = score; bestPlaced = res.placed; bestType = st;
          bestCuts = res.cutsCount; bestCutLines = res.cutLines;
        }
      }
      if (!bestPlaced) { warnings.push(`${items.length} pièce(s) ${material} ${thick}mm non placée(s)`); break; }

      bestType.used++;
      results.push({ sheetType: bestType, placed: bestPlaced, cutLines: bestCutLines, cuts: bestCuts, material, thick });
      const done = new Set(bestPlaced.map(p => p.uid));
      items = items.filter(i => !done.has(i.uid));
    }
  }

  warnings.forEach(w => toast(w, 'error'));
  tole_results = results;
  tole_drawResults(results);
  tole_updateStats(results);
  tole_sheets.forEach(s => renderUsedBadge('tole_used_' + s.id, s.used, s.stock));
  if (results.length) {
    document.querySelector('section:last-child')?.scrollIntoView({ behavior: 'smooth' });
    toast(`Calepinage ${tole_mode === 'surface' ? 'max surface' : 'min coupes'} — ${results.length} tôle(s) ✓`);
  }
}

/* ── Guillotine récursif : Max Surface (Best Area Fit) ── */
/**
 * Place les pièces dans la tôle via l'algorithme guillotine.
 * Stratégie : Best Area Fit — on choisit l'espace libre dont la surface résiduelle
 * est minimale après placement, puis Short Side Split pour la découpe.
 */
function packGuillotineMaxSurface(items, SW, SH, kerf) {
  let sections = [{ x: 0, y: 0, w: SW, h: SH }];
  const placed = [], cutLines = [];

  for (const item of items) {
    let bestSec = null, bestIdx = -1, bestScore = Infinity, bestRot = false;
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const tryFit = (iw, ih, rot) => {
        if (iw + kerf > sec.w || ih + kerf > sec.h) return;
        const score = sec.w * sec.h - iw * ih;
        if (score < bestScore) { bestScore = score; bestSec = sec; bestIdx = i; bestRot = rot; }
      };
      tryFit(item.w, item.h, false);
      if (item.rotate && item.w !== item.h) tryFit(item.h, item.w, true);
    }
    if (!bestSec) continue;

    const pw = bestRot ? item.h : item.w, ph = bestRot ? item.w : item.h;
    placed.push({ ...item, x: bestSec.x, y: bestSec.y, pw, ph, rotated: bestRot });

    const sec = bestSec, rw = sec.w - pw - kerf, rh = sec.h - ph - kerf;
    const newSecs = [];
    if (Math.max(rw * ph, sec.w * rh) >= Math.max(pw * rh, rw * sec.h)) {
      if (rw > kerf) newSecs.push({ x: sec.x + pw + kerf, y: sec.y,          w: rw,    h: ph + kerf });
      if (rh > kerf) newSecs.push({ x: sec.x,             y: sec.y + ph + kerf, w: sec.w, h: rh });
      if (rh > 0) cutLines.push({ type:'H', x1:sec.x, y1:sec.y+ph+kerf/2, x2:sec.x+sec.w, y2:sec.y+ph+kerf/2 });
      if (rw > 0) cutLines.push({ type:'V', x1:sec.x+pw+kerf/2, y1:sec.y, x2:sec.x+pw+kerf/2, y2:sec.y+ph+kerf });
    } else {
      if (rh > kerf) newSecs.push({ x: sec.x,             y: sec.y + ph + kerf, w: pw + kerf, h: rh });
      if (rw > kerf) newSecs.push({ x: sec.x + pw + kerf, y: sec.y,             w: rw,        h: sec.h });
      if (rw > 0) cutLines.push({ type:'V', x1:sec.x+pw+kerf/2, y1:sec.y,              x2:sec.x+pw+kerf/2, y2:sec.y+sec.h });
      if (rh > 0) cutLines.push({ type:'H', x1:sec.x,           y1:sec.y+ph+kerf/2,    x2:sec.x+pw+kerf,  y2:sec.y+ph+kerf/2 });
    }
    sections.splice(bestIdx, 1, ...newSecs.filter(s => s.w > kerf && s.h > kerf));
  }

  const seen = new Set();
  const uniqCuts = cutLines.filter(cl => {
    const k = `${cl.type}|${Math.round(cl.x1*2)}|${Math.round(cl.y1*2)}|${Math.round(cl.x2*2)}|${Math.round(cl.y2*2)}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
  const doneUids = new Set(placed.map(p => p.uid));
  return { placed, remaining: items.filter(i => !doneUids.has(i.uid)), cutsCount: uniqCuts.length, cutLines: uniqCuts };
}

/* ── Guillotine : Min Coupes (bandes horizontales) ── */
/**
 * Remplit la tôle bande par bande.
 * Pour chaque bande, on cherche la hauteur qui maximise le remplissage,
 * puis on place les pièces horizontalement dans la bande.
 * Minimise le nombre de coupes totales.
 */
function packGuillotineMinCuts(items, SW, SH, kerf) {
  const avail = items.map(i => ({ ...i }));
  const placed = [], cutLines = [];
  let cutsCount = 0, curY = 0;

  while (avail.length > 0 && curY < SH) {
    const remH = SH - curY;
    const bandHeights = new Set();
    avail.forEach(p => { bandHeights.add(p.h); if (p.rotate) bandHeights.add(p.w); });

    let bestBand = null, bestScore = -1;
    for (const bh of bandHeights) {
      if (bh > remH) continue;
      const res = fillBand(avail, SW, bh, kerf);
      if (!res.placed.length) continue;
      const score = res.placed.reduce((s, p) => s + p.pw * p.ph, 0) / (SW * bh);
      if (score > bestScore) { bestScore = score; bestBand = { bh, ...res }; }
    }
    if (!bestBand) break;

    if (curY + bestBand.bh < SH) {
      cutLines.push({ type:'H', x1:0, y1:curY+bestBand.bh+kerf/2, x2:SW, y2:curY+bestBand.bh+kerf/2 });
      cutsCount++;
    }
    bestBand.placed.forEach(p => placed.push({ ...p, y: p.y + curY }));
    bestBand.vertCuts.forEach(cx => {
      cutLines.push({ type:'V', x1:cx, y1:curY, x2:cx, y2:curY+bestBand.bh });
      cutsCount++;
    });
    const done = new Set(bestBand.placed.map(p => p.uid));
    for (let i = avail.length - 1; i >= 0; i--) { if (done.has(avail[i].uid)) avail.splice(i, 1); }
    curY += bestBand.bh + kerf;
  }

  const doneUids = new Set(placed.map(p => p.uid));
  return { placed, remaining: items.filter(i => !doneUids.has(i.uid)), cutLines, cutsCount };
}

/**
 * Remplit une bande horizontale avec les pièces disponibles.
 * Tri par largeur décroissante pour maximiser le remplissage.
 */
function fillBand(avail, SW, bandH, kerf) {
  const placed = [], vertCuts = [];
  let curX = 0;
  const usedUids = new Set();
  const cands = avail.map(p => {
    if (p.h <= bandH)             return { pw: p.w, ph: p.h, rot: false, item: p };
    if (p.rotate && p.w <= bandH) return { pw: p.h, ph: p.w, rot: true,  item: p };
    return null;
  }).filter(Boolean).sort((a, b) => b.pw - a.pw);

  for (const c of cands) {
    if (usedUids.has(c.item.uid) || c.pw > SW - curX) continue;
    usedUids.add(c.item.uid);
    placed.push({ ...c.item, x: curX, y: 0, pw: c.pw, ph: c.ph, rotated: c.rot });
    curX += c.pw + kerf;
    if (curX < SW) vertCuts.push(curX - kerf / 2);
  }
  return { placed, vertCuts };
}

/* ── Rendu canvas tôle (aperçu interactif) ── */

/**
 * Re-génère les plans de calepinage sur la page.
 * Crée un <canvas> par tôle utilisée.
 */
function tole_drawResults(results) {
  const grid = document.getElementById('tole_sheetsGrid'); if (!grid) return;
  grid.querySelectorAll('.sheet-wrap, .mat-group-header').forEach(e => e.remove());
  document.getElementById('tole_emptyState').style.display = results.length ? 'none' : '';

  // Largeur max responsive : 100% de la zone disponible, plafonnée à 1060px
  const MAXW = Math.min(window.innerWidth - 40, 1060);
  let lastKey = null;

  results.forEach((rs, idx) => {
    const { sheetType: st, placed, cutLines, material, thick } = rs;
    const gk = `${material}|${thick}`;

    // En-tête de groupe matière (une fois par groupe)
    if (gk !== lastKey) {
      lastKey = gk;
      const gS = results.filter(r => r.material === material && r.thick === thick);
      const gP = gS.reduce((s, r) => s + r.placed.length, 0);
      const gA = gS.reduce((s, r) => s + r.placed.reduce((a, p) => a + p.pw * p.ph, 0), 0) / 1e6;
      const el = document.createElement('div'); el.className = 'mat-group-header';
      el.innerHTML = `
        <span class="mat-group-pill">${esc(material)}</span>
        <span class="mat-group-pill" style="background:rgba(62,207,207,.12);color:var(--accent2);border-color:rgba(62,207,207,.35)">${thick} mm</span>
        <span>${gS.length} tôle(s) · ${gP} pièce(s) · ${gA.toFixed(3)} m²</span>`;
      grid.appendChild(el);
    }

    const scale    = Math.min(MAXW / st.w, 500 / st.h, 1);
    const usedArea = placed.reduce((s, p) => s + p.pw * p.ph, 0);
    const util     = (usedArea / (st.w * st.h) * 100).toFixed(1);
    const uc       = rateColor(parseFloat(util));

    const wrap = document.createElement('div'); wrap.className = 'sheet-wrap';
    const lbl  = document.createElement('div'); lbl.className  = 'result-lbl-row';
    lbl.innerHTML = `
      <span class="result-num tole">Tôle ${idx+1}/${results.length}</span>
      <span>${esc(st.name)}</span><span>·</span>
      <span>${st.w}×${st.h} mm · ép.${st.thick} mm · ${st.material}</span><span>·</span>
      <span>${placed.length} pièce(s)</span><span>·</span>
      <span style="color:var(--accent2)">✂ ${rs.cuts||0} coupe(s)</span>
      <span class="result-rate" style="background:${uc}1a;color:${uc};border:1px solid ${uc}44">${util}% utilisé</span>`;
    wrap.appendChild(lbl);

    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(st.w * scale);
    canvas.height = Math.round(st.h * scale);
    wrap.appendChild(canvas);
    grid.appendChild(wrap);
    drawSheetCanvas(canvas, st, placed, cutLines || [], scale);
  });
}

/**
 * Dessine un plan de coupe sur un canvas :
 *  1. Fond sombre + grille 100mm
 *  2. Bordure dorée de la tôle
 *  3. Panneaux : remplissage, hachures si rotation, contour
 *  4. Étiquette centrale + cotes sur bords droit et bas
 *  5. Traits de coupe (H rouge / V orange) + légende
 *  6. Règle 100mm
 */
function drawSheetCanvas(canvas, st, placed, cutLines, scale) {
  const ctx = canvas.getContext('2d');
  const cw = canvas.width, ch = canvas.height;

  // Fond
  ctx.fillStyle = '#1a1c22'; ctx.fillRect(0, 0, cw, ch);

  // Grille 100mm
  const gs = Math.round(100 * scale);
  if (gs > 4) {
    ctx.strokeStyle = '#252830'; ctx.lineWidth = 0.5;
    for (let x = 0; x <= cw; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,ch); ctx.stroke(); }
    for (let y = 0; y <= ch; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cw,y); ctx.stroke(); }
  }

  // Bordure tôle mère
  ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, cw-2, ch-2);

  // Panneaux
  placed.forEach(p => {
    const px = Math.round(p.x  * scale), py = Math.round(p.y  * scale);
    const pw = Math.round(p.pw * scale), ph = Math.round(p.ph * scale);

    ctx.fillStyle = p.color + 'bb'; ctx.fillRect(px+1, py+1, pw-2, ph-2);

    // Hachures si rotation
    if (p.rotated) {
      ctx.save(); ctx.beginPath(); ctx.rect(px+1, py+1, pw-2, ph-2); ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 5;
      for (let i = -ph; i < pw+ph; i += 14) { ctx.beginPath(); ctx.moveTo(px+i,py); ctx.lineTo(px+i+ph,py+ph); ctx.stroke(); }
      ctx.restore();
    }

    ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.strokeRect(px+0.5, py+0.5, pw, ph);

    // Étiquette centrale (nom + dimensions)
    if (pw > 36 && ph > 18) {
      const fs = Math.max(9, Math.min(13, ph * 0.26));
      ctx.fillStyle = '#fff'; ctx.font = `700 ${fs}px Barlow Condensed,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.name.length > 16 ? p.name.slice(0,14)+'…' : p.name,
        px + pw/2, py + ph/2 - (ph > 30 ? fs*0.55 : 0));
      if (ph > 26) {
        ctx.font = `${Math.max(8, fs-3)}px JetBrains Mono,monospace`;
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.fillText(`${p.pw}×${p.ph}${p.rotated?' ↻':''}`, px+pw/2, py+ph/2+fs*0.7);
      }
    }

    // Cotes dimensionnelles sur les bords
    const dimFs = Math.max(8, Math.min(11, Math.min(pw, ph) * 0.18));
    const DM = 4; // marge bord en px

    const drawDim = (text, tx, ty, angle) => {
      ctx.save();
      ctx.translate(tx, ty); if (angle) ctx.rotate(angle);
      ctx.font = `600 ${dimFs}px JetBrains Mono,monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const mw = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(0,0,0,.50)';
      ctx.fillRect(-mw/2-3, -dimFs/2-2, mw+6, dimFs+4);
      ctx.fillStyle = 'rgba(255,255,255,.88)';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };
    if (pw > 30) drawDim(`${p.pw}`, px+pw/2, py+ph-dimFs/2-DM);          // bord bas → largeur
    if (ph > 30) drawDim(`${p.ph}`, px+pw-dimFs/2-DM, py+ph/2, -Math.PI/2); // bord droit → hauteur
  });

  // Traits de coupe
  if (cutLines.length) {
    cutLines.forEach(cl => {
      ctx.save();
      ctx.strokeStyle = cl.type === 'H' ? '#ff4040' : '#ff9900';
      ctx.lineWidth = 1.5; ctx.setLineDash([6,4]); ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.moveTo(Math.round(cl.x1*scale), Math.round(cl.y1*scale));
      ctx.lineTo(Math.round(cl.x2*scale), Math.round(cl.y2*scale));
      ctx.stroke(); ctx.restore();
    });
    // Légende
    ctx.save();
    ctx.fillStyle = 'rgba(15,16,20,.8)'; ctx.fillRect(cw-158, ch-46, 150, 38);
    ctx.font = '10px JetBrains Mono,monospace'; ctx.textBaseline = 'middle';
    ['#ff4040','#ff9900'].forEach((col, i) => {
      const y = ch - 36 + i * 18;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.moveTo(cw-152,y); ctx.lineTo(cw-132,y); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = col; ctx.textAlign = 'left';
      ctx.fillText(i===0 ? 'Coupe H' : 'Coupe V', cw-128, y);
    });
    ctx.restore();
  }

  // Règle 100mm
  if (gs > 10) {
    ctx.fillStyle = 'rgba(245,166,35,.5)'; ctx.fillRect(14, ch-13, gs, 3);
    ctx.fillStyle = '#f5a623'; ctx.font = '9px JetBrains Mono,monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('100mm', 14, ch-14);
  }
}

function tole_updateStats(rs) {
  let sa = 0, pa = 0, placed = 0, cuts = 0;
  rs.forEach(r => {
    sa    += r.sheetType.w * r.sheetType.h;
    cuts  += r.cuts || 0;
    r.placed.forEach(p => { pa += p.pw * p.ph; placed++; });
  });
  const rate  = sa ? (pa / sa * 100).toFixed(1) : 0;
  const waste = ((sa - pa) / 1e6).toFixed(3);
  document.getElementById('tole_statSheets').textContent = rs.length;
  document.getElementById('tole_statPlaced').textContent = placed;
  document.getElementById('tole_statCuts').textContent   = cuts + (cuts ? ' coupe(s)' : '');
  const rEl = document.getElementById('tole_statRate');
  rEl.textContent = rate + '%'; rEl.className = 'stat-val ' + rateClass(parseFloat(rate));
  document.getElementById('tole_statBar').style.width = rate + '%';
  const wEl = document.getElementById('tole_statWaste');
  wEl.textContent = waste + ' m²';
  wEl.className   = 'stat-val ' + (parseFloat(waste) < 0.2 ? 'good' : parseFloat(waste) < 1 ? 'warn' : 'bad');
}
function tole_clearResults() {
  document.getElementById('tole_sheetsGrid')?.querySelectorAll('.sheet-wrap,.mat-group-header').forEach(e => e.remove());
  document.getElementById('tole_emptyState').style.display = '';
  clearStats(['tole_statSheets','tole_statPlaced','tole_statRate','tole_statCuts','tole_statWaste'], 'tole_statBar');
}

/** Canvas haute résolution pour PDF/JPEG/PNG (2480×1754 px) */
function tole_renderSheetToCanvas(rs, idx, total) {
  const PW=2480, PH=1754, MARGIN=80, HEADER_H=110, FOOTER_H=40;
  const oc = document.createElement('canvas'); oc.width=PW; oc.height=PH;
  const ctx = oc.getContext('2d');
  const { sheetType: st, placed, cutLines=[] } = rs;
  const usedArea = placed.reduce((s, p) => s + p.pw * p.ph, 0);
  const util     = (usedArea / (st.w * st.h) * 100).toFixed(1);
  const wasteM2  = ((st.w * st.h - usedArea) / 1e6).toFixed(4);
  const uc = rateColor(parseFloat(util)).replace('var(--green)','#52c97a').replace('var(--accent)','#f5a623').replace('var(--danger)','#e05252');
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,PW,PH);
  pdfDrawHeader(ctx,PW,MARGIN,HEADER_H,`Tôle ${idx+1}/${total} — ${st.name}`,`${st.w}×${st.h} mm · ép.${st.thick} mm · ${st.material} · jeu ${st.kerf} mm`);
  const planAW = PW - MARGIN*2; let planW=planAW, planH=Math.round(planW*st.h/st.w);
  if (planH>900) { planH=900; planW=Math.round(planH*st.w/st.h); }
  const planX=MARGIN+Math.round((planAW-planW)/2), planY=HEADER_H+50, sc=planW/st.w;
  const tmp=document.createElement('canvas'); tmp.width=planW; tmp.height=planH;
  drawSheetCanvas(tmp, st, placed, cutLines, sc); ctx.drawImage(tmp, planX, planY);
  ctx.fillStyle=uc+'33'; roundRect(ctx,PW-MARGIN-230,planY+planH-68,210,50,8); ctx.fill();
  ctx.strokeStyle=uc; ctx.lineWidth=2; roundRect(ctx,PW-MARGIN-230,planY+planH-68,210,50,8); ctx.stroke();
  ctx.fillStyle=uc; ctx.font='bold 28px Arial'; ctx.textAlign='center';
  ctx.fillText(`${util}% utilisé`, PW-MARGIN-125, planY+planH-40);
  const tY=planY+planH+45;
  const cols=['#','Panneau','Matière','Ép.','L (mm)','H (mm)','X (mm)','Y (mm)','Rot.'];
  const colW=[50,430,210,150,155,155,155,155,95];
  const rows=placed.map((p,i)=>({color:p.color, vals:[i+1,p.name,p.material||'—',p.thick||'—',p.pw,p.ph,p.x,p.y,p.rotated?'↻':'-']}));
  const afterTable=pdfDrawTable(ctx,MARGIN,tY,PW-MARGIN*2,cols,colW,rows);
  ctx.fillStyle='#e8ecf2'; ctx.fillRect(MARGIN,afterTable+16,PW-MARGIN*2,50);
  ctx.fillStyle='#445566'; ctx.font='22px Arial'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(`Tôle : ${(st.w*st.h/1e6).toFixed(4)} m²  |  Panneaux : ${(usedArea/1e6).toFixed(4)} m²  |  Chutes : ${wasteM2} m²  |  Taux : ${util}%  |  Jeu : ${st.kerf} mm`, MARGIN+14, afterTable+41);
  pdfDrawFooter(ctx,PW,PH,MARGIN,FOOTER_H);
  return oc;
}

/* =============================================================
   8. MODULE BARRE — données & algorithme FFD
   ============================================================= */

// ── État ──
let b_pieces   = [];  // pièces à débiter
let b_bars     = [];  // barres mères disponibles
let b_results  = [];  // résultats (pour export)
let b_pieceId  = 0;
let b_barId    = 0;
let b_colorIdx = { v: 0 };

/**
 * Calcule la longueur réelle d'une pièce en tenant compte des biseaux.
 * Formule : lenHT + tan(angL) * profil + tan(angR) * profil
 */
const b_realLength = (lenHT, angL, angR, profil) =>
  lenHT + Math.tan(angL * Math.PI / 180) * profil
        + Math.tan(angR * Math.PI / 180) * profil;

/* ── Reset ── */
function barre_resetPieces() {
  if (!b_pieces.length || !confirm('Vider toutes les pièces ?')) return;
  b_pieces = []; barre_renderPieces(); toast('Pièces réinitialisées');
}
function barre_resetAll() {
  if (!confirm('Tout réinitialiser (module barre) ?')) return;
  b_pieces = []; b_bars = []; b_results = []; b_pieceId = b_barId = 0; b_colorIdx.v = 0;
  barre_renderPieces(); barre_renderBars(); barre_clearResults(); toast('Module barre réinitialisé');
}

/* ── CRUD barres mères ── */
function barre_addBar() {
  const name  = document.getElementById('b_barName').value.trim() || 'Barre';
  const len   = parseFloat(document.getElementById('b_barLen').value);
  const stock = parseInt(document.getElementById('b_barStock').value);
  if (!len || !stock) return;
  b_bars.push({ id: ++b_barId, name, len, stock, used: 0 });
  barre_renderBars();
}
function barre_removeBar(id) { b_bars = b_bars.filter(b => b.id !== id); barre_renderBars(); }
function barre_updateBar(id, field, value) {
  const b = b_bars.find(b => b.id === id); if (!b) return;
  b[field] = field === 'name' ? value : (parseFloat(value) || b[field]);
  const sumEl = document.getElementById('barre_barSummary');
  if (sumEl) sumEl.textContent = `${b_bars.length} longueur(s)`;
}
function barre_renderBars() {
  const tbody = document.getElementById('barre_barBody'); if (!tbody) return;
  tbody.innerHTML = !b_bars.length
    ? '<tr class="empty-row"><td colspan="5">Aucune barre mère — utilisez le formulaire ci-dessus</td></tr>'
    : b_bars.map(b => `<tr id="b_brow_${b.id}">
        <td><input class="cell-input" style="min-width:120px" value="${esc(b.name)}"
               onchange="barre_updateBar(${b.id},'name',this.value)"></td>
        <td><input class="cell-input" type="number" min="1" value="${b.len}"
               onchange="barre_updateBar(${b.id},'len',this.value)"></td>
        <td><input class="cell-input" type="number" min="1" value="${b.stock}"
               onchange="barre_updateBar(${b.id},'stock',this.value)"></td>
        <td class="center" id="b_bused_${b.id}"><span class="badge">—</span></td>
        <td class="center"><button class="btn-del" onclick="barre_removeBar(${b.id})">✕</button></td>
      </tr>`).join('');
  const sumEl = document.getElementById('barre_barSummary');
  if (sumEl) sumEl.textContent = `${b_bars.length} longueur(s)`;
  persist_save();
}

/* ── CRUD pièces à débiter ── */
function barre_addPiece() {
  const name  = document.getElementById('b_pName').value.trim() || 'Pièce';
  const lenHT = parseFloat(document.getElementById('b_pLen').value);
  const angL  = parseFloat(document.getElementById('b_pAngL').value) || 0;
  const angR  = parseFloat(document.getElementById('b_pAngR').value) || 0;
  const qty   = parseInt(document.getElementById('b_pQty').value) || 1;
  const color = document.getElementById('b_pColor').value;
  if (!lenHT || !qty) return;
  b_pieces.push({ id: ++b_pieceId, name, lenHT, angL, angR, qty, color });
  nextColor('b_pColor', b_colorIdx);
  autoNextName('b_pName');
  barre_renderPieces();
}
function barre_removePiece(id) { b_pieces = b_pieces.filter(p => p.id !== id); barre_renderPieces(); }
function barre_updatePiece(id, field, value) {
  const p = b_pieces.find(p => p.id === id); if (!p) return;
  p[field] = (field === 'name' || field === 'color') ? value : (parseFloat(value) || p[field]);
  barre_renderPieces();
}
function barre_updatePieceColor(id, value) {
  const p = b_pieces.find(p => p.id === id); if (!p) return; p.color = value;
  const sw = document.querySelector(`#b_prow_${id} .swatch`); if (sw) sw.style.background = value;
}
function barre_renderPieces() {
  const tbody = document.getElementById('barre_pieceBody'); if (!tbody) return;
  const profil = parseFloat(document.getElementById('b_profil')?.value) || 50;
  tbody.innerHTML = !b_pieces.length
    ? '<tr class="empty-row"><td colspan="8">Aucune pièce — utilisez le formulaire ci-dessus</td></tr>'
    : b_pieces.map(p => {
        const real = b_realLength(p.lenHT, p.angL, p.angR, profil);
        return `<tr id="b_prow_${p.id}">
          <td><div class="name-cell">
            <span class="swatch" style="background:${p.color}"></span>
            <input class="cell-input" style="min-width:80px" value="${esc(p.name)}"
                   onchange="barre_updatePiece(${p.id},'name',this.value)">
            <input type="color" class="cell-color" value="${p.color}"
                   oninput="barre_updatePieceColor(${p.id},this.value)">
          </div></td>
          <td><input class="cell-input" type="number" min="1" value="${p.lenHT}"
                 onchange="barre_updatePiece(${p.id},'lenHT',this.value)"></td>
          <td><input class="cell-input" type="number" min="0" max="60" step="1" value="${p.angL}"
                 onchange="barre_updatePiece(${p.id},'angL',this.value)"></td>
          <td><input class="cell-input" type="number" min="0" max="60" step="1" value="${p.angR}"
                 onchange="barre_updatePiece(${p.id},'angR',this.value)"></td>
          <td class="mono" style="color:var(--accent2)">${real.toFixed(1)} mm</td>
          <td><input class="cell-input" type="number" min="1" value="${p.qty}"
                 onchange="barre_updatePiece(${p.id},'qty',this.value)"></td>
          <td class="mono">${(real*p.qty).toFixed(0)} mm</td>
          <td class="center"><button class="btn-del" onclick="barre_removePiece(${p.id})">✕</button></td>
        </tr>`;
      }).join('');
  const sumEl = document.getElementById('barre_pieceSummary');
  if (sumEl) sumEl.textContent = `${b_pieces.reduce((s,p)=>s+p.qty,0)} pièce(s)`;
  persist_save();
}

/* ── Algorithme débit de barre : First Fit Decreasing ── */
/**
 * Trie les pièces par longueur décroissante, puis pour chaque pièce :
 *  1. Tente de la placer dans une barre déjà ouverte (First Fit)
 *  2. Sinon, ouvre la barre mère la plus courte qui convient (Min Length)
 */
function barre_optimize() {
  if (!b_pieces.length) { toast('Section 3 : ajoutez des pièces !', 'error'); return; }
  if (!b_bars.length)   { toast('Section 2 : ajoutez des barres mères !', 'error'); return; }

  const kerf     = parseFloat(document.getElementById('b_kerf')?.value)     || 3;
  const profil   = parseFloat(document.getElementById('b_profil')?.value)   || 50;
  const minWaste = parseFloat(document.getElementById('b_minWaste')?.value) || 0;

  // Développer les quantités + calculer la longueur réelle
  let items = [];
  b_pieces.forEach(p => {
    const real = b_realLength(p.lenHT, p.angL, p.angR, profil);
    for (let i = 0; i < p.qty; i++) items.push({ ...p, uid: `${p.id}_${i}`, real });
  });
  items.sort((a, b) => b.real - a.real); // FFD : tri décroissant

  // Vérifier les pièces trop longues
  const maxBarLen = Math.max(...b_bars.map(b => b.len));
  const tooLong   = items.filter(i => i.real + kerf * 2 > maxBarLen);
  if (tooLong.length) { toast(`${tooLong.length} pièce(s) trop longue(s) !`, 'error'); return; }

  b_bars.forEach(b => b.used = 0);
  const openBars = [], warnings = [];

  for (const item of items) {
    let placed = false;

    // 1. Chercher une barre déjà ouverte avec assez de place
    for (const ob of openBars) {
      const needed = item.real + kerf;
      const after  = ob.remainLen - needed;
      if (needed <= ob.remainLen && (after === 0 || after >= minWaste)) {
        ob.pieces.push({ piece: item, x: ob.barType.len - ob.remainLen });
        ob.remainLen -= needed;
        ob.cuts++;
        placed = true;
        break;
      }
    }

    if (!placed) {
      // 2. Ouvrir la barre mère la plus courte qui convient (min gaspillage)
      let bestBar = null;
      for (const bt of b_bars) {
        if (bt.used >= bt.stock) continue;
        const after = bt.len - kerf - item.real;
        if (after < 0 || (after > 0 && after < minWaste)) continue;
        if (!bestBar || bt.len < bestBar.len) bestBar = bt;
      }
      if (!bestBar) { warnings.push(`Pièce "${item.name}" non placée — stock épuisé`); continue; }
      bestBar.used++;
      openBars.push({
        barType:    bestBar,
        pieces:     [{ piece: item, x: kerf }],
        remainLen:  bestBar.len - kerf - item.real,
        cuts:       1
      });
    }
  }

  warnings.forEach(w => toast(w, 'error'));
  b_results = openBars;
  barre_drawResults(openBars, kerf, profil);
  barre_updateStats(openBars);
  b_bars.forEach(bt => renderUsedBadge('b_bused_' + bt.id, bt.used, bt.stock));
  if (openBars.length) {
    document.querySelector('section:last-child')?.scrollIntoView({ behavior: 'smooth' });
    toast(`Débit optimisé — ${openBars.length} barre(s) ✓`);
  }
}

/* ── Rendu résultats barre ── */
function barre_drawResults(openBars, kerf, profil) {
  const grid = document.getElementById('barre_resultsGrid'); if (!grid) return;
  grid.querySelectorAll('.bar-row').forEach(e => e.remove());
  document.getElementById('barre_emptyState').style.display = openBars.length ? 'none' : '';
  const MAXW = Math.min(window.innerWidth - 80, 1060), BAR_H = 52;

  openBars.forEach((ob, idx) => {
    const { barType: bt, pieces, remainLen, cuts } = ob;
    const scale    = MAXW / bt.len;
    const usedLen  = bt.len - remainLen;
    const util     = (usedLen / bt.len * 100).toFixed(1);
    const uc       = rateColor(parseFloat(util));

    const row = document.createElement('div'); row.className = 'bar-row';
    const lbl = document.createElement('div'); lbl.className = 'result-lbl-row';
    lbl.innerHTML = `
      <span class="result-num barre">Barre ${idx+1}/${openBars.length}</span>
      <span>${esc(bt.name)}</span><span>·</span><span>${bt.len} mm</span><span>·</span>
      <span>${pieces.length} pièce(s)</span><span>·</span><span>✂ ${cuts} coupe(s)</span><span>·</span>
      <span>Chute : ${remainLen.toFixed(0)} mm</span>
      <span class="result-rate" style="background:${uc}1a;color:${uc};border:1px solid ${uc}44">${util}% utilisé</span>`;
    row.appendChild(lbl);

    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(bt.len * scale);
    canvas.height = BAR_H;
    row.appendChild(canvas);
    grid.appendChild(row);
    drawBarCanvas(canvas, bt, pieces, remainLen, kerf, profil, scale);
  });
}

/** Dessine le plan d'une barre sur un canvas */
function drawBarCanvas(canvas, bt, pieces, remainLen, kerf, profil, scale) {
  const ctx = canvas.getContext('2d');
  const cw = canvas.width, ch = canvas.height;
  ctx.fillStyle = '#1a1c22'; ctx.fillRect(0,0,cw,ch);
  ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.strokeRect(0.5,0.5,cw-1,ch-1);

  // Zone chute à droite
  if (remainLen > 1) {
    const cx = Math.round((bt.len - remainLen) * scale);
    ctx.fillStyle = 'rgba(224,82,82,.12)'; ctx.fillRect(cx,0,cw-cx,ch);
    ctx.strokeStyle = 'rgba(224,82,82,.3)'; ctx.lineWidth=1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx,ch); ctx.stroke(); ctx.setLineDash([]);
    if (cw-cx > 40) {
      ctx.fillStyle='rgba(224,82,82,.5)'; ctx.font='10px JetBrains Mono,monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`${remainLen.toFixed(0)}mm`, cx+(cw-cx)/2, ch/2);
    }
  }

  // Pièces
  pieces.forEach(({ piece: p, x }) => {
    const px = Math.round(x * scale), pw = Math.round(p.real * scale);
    const dL = Math.round(Math.tan(p.angL * Math.PI/180) * profil * scale);
    const dR = Math.round(Math.tan(p.angR * Math.PI/180) * profil * scale);
    ctx.beginPath();
    ctx.moveTo(px,0); ctx.lineTo(px+dL,ch); ctx.lineTo(px+pw-dR,ch); ctx.lineTo(px+pw,0);
    ctx.closePath();
    ctx.fillStyle = p.color + 'cc'; ctx.fill();
    ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.stroke();
    const midX = px + pw/2;
    if (pw > 30) {
      ctx.fillStyle='#fff'; ctx.font='bold 11px Barlow Condensed,sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(p.name.length>12?p.name.slice(0,10)+'…':p.name, midX, ch/2-(pw>60?5:0));
      if (pw > 70) {
        ctx.font='9px JetBrains Mono,monospace'; ctx.fillStyle='rgba(255,255,255,.5)';
        const ang = (p.angL!==0||p.angR!==0) ? ` ${p.angL}°/${p.angR}°` : '';
        ctx.fillText(`${p.lenHT}mm${ang}`, midX, ch/2+7);
      }
    }
  });

  // Trait de lame
  const kpx = Math.max(1, Math.round(kerf * scale));
  ctx.fillStyle = 'rgba(255,60,60,.7)'; ctx.fillRect(0,0,kpx,ch);
  pieces.forEach(({ x }, i) => {
    if (i > 0) { ctx.fillStyle='rgba(255,60,60,.7)'; ctx.fillRect(Math.round(x*scale)-kpx/2,0,kpx,ch); }
  });

  // Règle 500mm
  const gs500 = Math.round(500 * scale);
  if (gs500 > 20) {
    ctx.fillStyle='rgba(245,166,35,.5)'; ctx.fillRect(6,ch-8,gs500,3);
    ctx.fillStyle='#f5a623'; ctx.font='8px JetBrains Mono,monospace';
    ctx.textAlign='left'; ctx.textBaseline='bottom'; ctx.fillText('500mm',6,ch-9);
  }
}

function barre_updateStats(openBars) {
  const totalLen = openBars.reduce((s, ob) => s + ob.barType.len, 0);
  const usedLen  = openBars.reduce((s, ob) => s + ob.pieces.reduce((a, {piece:p}) => a + p.real, 0), 0);
  const rate     = totalLen ? (usedLen / totalLen * 100).toFixed(1) : 0;
  const pieces   = openBars.reduce((s, ob) => s + ob.pieces.length, 0);
  const cuts     = openBars.reduce((s, ob) => s + ob.cuts, 0);
  document.getElementById('b_statBars').textContent    = openBars.length;
  document.getElementById('b_statPieces').textContent  = pieces;
  document.getElementById('b_statWaste').textContent   = (totalLen - usedLen).toFixed(0) + ' mm';
  document.getElementById('b_statCuts').textContent    = cuts + ' coupe(s)';
  const rEl = document.getElementById('b_statRate');
  rEl.textContent = rate + '%'; rEl.className = 'stat-val ' + rateClass(parseFloat(rate));
  document.getElementById('b_statBar').style.width = rate + '%';
}
function barre_clearResults() {
  document.getElementById('barre_resultsGrid')?.querySelectorAll('.bar-row').forEach(e => e.remove());
  document.getElementById('barre_emptyState').style.display = '';
  clearStats(['b_statBars','b_statPieces','b_statRate','b_statWaste','b_statCuts'], 'b_statBar');
}

/** Canvas haute résolution pour export barre */
function barre_renderBarToCanvas(ob, idx, total, kerf, profil) {
  const PW=2480, PH=1754, MARGIN=80, HEADER_H=110, FOOTER_H=40;
  const oc=document.createElement('canvas'); oc.width=PW; oc.height=PH;
  const ctx=oc.getContext('2d');
  const { barType:bt, pieces, remainLen, cuts } = ob;
  const usedLen=bt.len-remainLen; const util=(usedLen/bt.len*100).toFixed(1);
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,PW,PH);
  pdfDrawHeader(ctx,PW,MARGIN,HEADER_H,`Barre ${idx+1}/${total} — ${bt.name}`,`${bt.len} mm · ${pieces.length} pièce(s) · ✂ ${cuts} coupe(s) · chute ${remainLen.toFixed(0)} mm`);
  const planY=HEADER_H+60,planH=180,planX=MARGIN,planW=PW-MARGIN*2,sc=planW/bt.len;
  const tmp=document.createElement('canvas'); tmp.width=planW; tmp.height=planH;
  drawBarCanvas(tmp,bt,pieces,remainLen,kerf,profil,sc); ctx.drawImage(tmp,planX,planY);
  const uc=parseFloat(util)>=80?'#52c97a':parseFloat(util)>=60?'#f5a623':'#e05252';
  ctx.fillStyle=uc+'33'; roundRect(ctx,PW-MARGIN-230,planY+planH-68,210,50,8); ctx.fill();
  ctx.strokeStyle=uc; ctx.lineWidth=2; roundRect(ctx,PW-MARGIN-230,planY+planH-68,210,50,8); ctx.stroke();
  ctx.fillStyle=uc; ctx.font='bold 28px Arial'; ctx.textAlign='center';
  ctx.fillText(`${util}% utilisé`,PW-MARGIN-125,planY+planH-40);
  const gs1000=Math.round(1000*sc);
  ctx.fillStyle='rgba(245,166,35,.5)'; ctx.fillRect(planX,planY+planH+20,gs1000,5);
  ctx.fillStyle='#f5a623'; ctx.font='24px Arial'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('1000 mm',planX,planY+planH+28);
  const tY=planY+planH+100;
  const cols=['#','Pièce','Long. HT (mm)','Angle G (°)','Angle D (°)','Long. réelle (mm)','X départ (mm)'];
  const colW=[55,480,260,200,200,260,260];
  const rows=pieces.map(({piece:p,x},i)=>({color:p.color,vals:[i+1,p.name,p.lenHT,p.angL,p.angR,p.real.toFixed(1),x.toFixed(0)]}));
  const afterTable=pdfDrawTable(ctx,MARGIN,tY,PW-MARGIN*2,cols,colW,rows);
  ctx.fillStyle='#e8ecf2'; ctx.fillRect(MARGIN,afterTable+16,PW-MARGIN*2,50);
  ctx.fillStyle='#445566'; ctx.font='22px Arial'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(`Barre ${bt.len} mm  |  Utilisé ${usedLen.toFixed(0)} mm  |  Chute ${remainLen.toFixed(0)} mm  |  Taux ${util}%  |  Lame ${kerf} mm`,MARGIN+14,afterTable+41);
  pdfDrawFooter(ctx,PW,PH,MARGIN,FOOTER_H);
  return oc;
}

/* =============================================================
   9. PERSISTANCE localStorage
   ============================================================= */

/**
 * Sauvegarde l'état complet de l'application.
 * Appelée automatiquement à chaque modification.
 */
function persist_save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tole_pieces, tole_sheets, tole_pieceId, tole_sheetId,
      tole_colorIdx: tole_colorIdx.v, tole_mode,
      b_pieces, b_bars, b_pieceId, b_barId, b_colorIdx: b_colorIdx.v,
      b_kerf:     parseFloat(document.getElementById('b_kerf')?.value)     || 3,
      b_profil:   parseFloat(document.getElementById('b_profil')?.value)   || 50,
      b_minWaste: parseFloat(document.getElementById('b_minWaste')?.value) || 0,
    }));
  } catch { /* Quota dépassé ou navigation privée — silencieux */ }
}

/**
 * Restaure l'état depuis le localStorage.
 * @returns {boolean} true si une session a été restaurée
 */
function persist_load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    tole_pieces   = s.tole_pieces  || [];
    tole_sheets   = s.tole_sheets  || [];
    tole_pieceId  = s.tole_pieceId || tole_pieces.length;
    tole_sheetId  = s.tole_sheetId || tole_sheets.length;
    tole_colorIdx.v = s.tole_colorIdx ?? 0;
    if (s.tole_mode) tole_setMode(s.tole_mode);
    b_pieces  = s.b_pieces || [];
    b_bars    = s.b_bars   || [];
    b_pieceId = s.b_pieceId || b_pieces.length;
    b_barId   = s.b_barId  || b_bars.length;
    b_colorIdx.v = s.b_colorIdx ?? 0;
    if (s.b_kerf     != null) { const el=document.getElementById('b_kerf');     if(el) el.value=s.b_kerf; }
    if (s.b_profil   != null) { const el=document.getElementById('b_profil');   if(el) el.value=s.b_profil; }
    if (s.b_minWaste != null) { const el=document.getElementById('b_minWaste'); if(el) el.value=s.b_minWaste; }
    return true;
  } catch { return false; }
}

/**
 * Efface le localStorage et recharge la page (retour aux données d'exemple).
 */
function persist_clear() {
  if (!confirm("Effacer la mémoire et recharger les données d'exemple ?")) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  location.reload();
}

/* =============================================================
   10. DONNÉES D'EXEMPLE (premier lancement)
   ============================================================= */

/** Charge les données d'exemple dans les deux modules */
function loadExampleData() {
  [
    { name:'Flanc gauche', w:600, h:400, thick:3,   material:'Acier',     qty:2, color:'#3ecfcf', rotate:true  },
    { name:'Flanc droit',  w:600, h:400, thick:3,   material:'Acier',     qty:2, color:'#f5a623', rotate:true  },
    { name:'Fond',         w:800, h:300, thick:2,   material:'Acier',     qty:1, color:'#52c97a', rotate:false },
    { name:'Couvercle',    w:500, h:250, thick:1.5, material:'Aluminium', qty:3, color:'#a78bfa', rotate:true  },
  ].forEach(e => tole_pieces.push({ ...e, id: ++tole_pieceId }));
  tole_colorIdx.v = 4;

  [
    { name:'Standard 2000×1000',     w:2000, h:1000, thick:3,   material:'Acier',     stock:5, kerf:3 },
    { name:'Grand format 3000×1500', w:3000, h:1500, thick:3,   material:'Acier',     stock:3, kerf:4 },
    { name:'Alu 1500×750',           w:1500, h:750,  thick:1.5, material:'Aluminium', stock:8, kerf:2 },
  ].forEach(e => tole_sheets.push({ ...e, id: ++tole_sheetId, used: 0 }));

  [
    { name:'Barre 6000mm', len:6000, stock:5 },
    { name:'Barre 3000mm', len:3000, stock:3 },
  ].forEach(e => b_bars.push({ ...e, id: ++b_barId, used: 0 }));

  [
    { name:'Montant',  lenHT:1200, angL:0,  angR:0,  qty:4, color:'#3ecfcf' },
    { name:'Traverse', lenHT:800,  angL:45, angR:45, qty:6, color:'#f5a623' },
    { name:'Diag.',    lenHT:650,  angL:30, angR:0,  qty:4, color:'#52c97a' },
    { name:'Listeau',  lenHT:400,  angL:0,  angR:0,  qty:8, color:'#a78bfa' },
  ].forEach(e => b_pieces.push({ ...e, id: ++b_pieceId }));
  b_colorIdx.v = 4;
}

/* =============================================================
   11. INITIALISATION COMMUNE — appelée par chaque page app
   ============================================================= */

/**
 * Point d'entrée commun à tole.html et barre.html.
 * Initialise les selects, les modales, restaure la session.
 */
function initApp() {
  initMaterialSelects();
  initModals();
  const restored = persist_load();
  if (!restored) loadExampleData();

  // Rafraîchir les tableaux présents sur la page courante
  if (typeof tole_renderPieces === 'function') tole_renderPieces();
  if (typeof tole_renderSheets === 'function') tole_renderSheets();
  if (typeof barre_renderBars  === 'function') barre_renderBars();
  if (typeof barre_renderPieces=== 'function') barre_renderPieces();

  if (restored) toast('Session restaurée ✓');
}
