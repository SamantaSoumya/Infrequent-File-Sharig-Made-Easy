/* ════════════════════════════════════════════════════════════════
   InFrequent — P2P File Sharing
   Three.js 3D Background + WebRTC DataChannel via PeerJS
   + QR Code + JSZip multi-file support
   ════════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────────
   0.  Init Lucide Icons
──────────────────────────────────────────────────────────────────*/
lucide.createIcons();

/* ─────────────────────────────────────────────────────────────────
   1.  THREE.JS SCENE  — Particle Network + Floating Meshes
──────────────────────────────────────────────────────────────────*/
(function initThreeScene() {
  const canvas   = document.getElementById('bg-canvas');
  const W        = () => window.innerWidth;
  const H        = () => window.innerHeight;

  /* Renderer */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, W() / H(), 0.1, 100);
  camera.position.z = 7;

  /* ── Particle Field ──────────────────────────────────────── */
  const PARTICLE_COUNT = 130;
  const pPos  = new Float32Array(PARTICLE_COUNT * 3);
  const pVel  = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pPos[i*3]   = (Math.random() - 0.5) * 20;
    pPos[i*3+1] = (Math.random() - 0.5) * 20;
    pPos[i*3+2] = (Math.random() - 0.5) * 9;
    pVel.push({
      x: (Math.random() - 0.5) * 0.014,
      y: (Math.random() - 0.5) * 0.014,
      z: (Math.random() - 0.5) * 0.007
    });
  }

  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const ptMat = new THREE.PointsMaterial({
    color: 0x00d4ff, size: 0.055,
    transparent: true, opacity: 0.75
  });
  scene.add(new THREE.Points(ptGeo, ptMat));

  /* ── Connection Lines ────────────────────────────────────── */
  const MAX_SEGS = 220; // max line segments
  const lPos = new Float32Array(MAX_SEGS * 2 * 3); // each segment = 2 verts × 3 floats
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x00d4ff, transparent: true, opacity: 0.11
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lines);

  /* ── Icosahedron (main floating mesh — right side) ───────── */
  const icoGeo  = new THREE.IcosahedronGeometry(1.15, 1);
  const icoWire = new THREE.Mesh(icoGeo, new THREE.MeshPhongMaterial({
    color: 0x7c3aed,
    emissive: 0x00d4ff,
    emissiveIntensity: 0.15,
    wireframe: true,
    transparent: true,
    opacity: 0.5
  }));
  const icoCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.92, 1),
    new THREE.MeshPhongMaterial({ color: 0x080a22, transparent: true, opacity: 0.7 })
  );
  const icoGroup = new THREE.Group();
  icoGroup.add(icoWire, icoCore);
  icoGroup.position.set(3.8, 0.5, -1.5);
  scene.add(icoGroup);

  /* ── Octahedron (secondary mesh — left side) ─────────────── */
  const octWire = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.75, 0),
    new THREE.MeshPhongMaterial({
      color: 0x00d4ff,
      emissive: 0x7c3aed,
      emissiveIntensity: 0.12,
      wireframe: true,
      transparent: true,
      opacity: 0.45
    })
  );
  const octGroup = new THREE.Group();
  octGroup.add(octWire);
  octGroup.position.set(-4.2, -0.6, -1.5);
  scene.add(octGroup);

  /* ── Torus (subtle, background) ──────────────────────────── */
  const torusWire = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.35, 10, 28),
    new THREE.MeshPhongMaterial({
      color: 0xec4899,
      wireframe: true,
      transparent: true,
      opacity: 0.12
    })
  );
  torusWire.position.set(-1, 3.5, -4);
  scene.add(torusWire);

  /* ── Lights ──────────────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const pl1 = new THREE.PointLight(0x00d4ff, 3.5, 18);
  pl1.position.set(-6, 5, 3);
  scene.add(pl1);
  const pl2 = new THREE.PointLight(0x7c3aed, 3.5, 18);
  pl2.position.set(6, -5, 3);
  scene.add(pl2);

  /* ── Mouse Parallax ──────────────────────────────────────── */
  const mouse = { x: 0, y: 0 };
  document.addEventListener('mousemove', e => {
    mouse.x = (e.clientX / W() - 0.5) * 2;
    mouse.y = -(e.clientY / H() - 0.5) * 2;
  });

  /* ── Animation Loop ──────────────────────────────────────── */
  let t = 0;
  function tick() {
    requestAnimationFrame(tick);
    t += 0.006;

    /* Update particle positions + build connection lines */
    let vc = 0; // vertex count for line segments
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      pPos[ix]   += pVel[i].x;
      pPos[ix+1] += pVel[i].y;
      pPos[ix+2] += pVel[i].z;

      /* Bounce off invisible walls */
      if (Math.abs(pPos[ix])   > 10) pVel[i].x *= -1;
      if (Math.abs(pPos[ix+1]) > 10) pVel[i].y *= -1;
      if (Math.abs(pPos[ix+2]) > 4.5) pVel[i].z *= -1;

      /* Connect nearby particles */
      for (let j = i + 1; j < PARTICLE_COUNT && vc < MAX_SEGS * 2 - 2; j++) {
        const jx = j * 3;
        const dx = pPos[ix]   - pPos[jx];
        const dy = pPos[ix+1] - pPos[jx+1];
        const dz = pPos[ix+2] - pPos[jx+2];
        const d2 = dx*dx + dy*dy + dz*dz;
        if (d2 < 8.5) { // distance threshold ≈ 2.9 units
          lPos[vc*3] = pPos[ix];   lPos[vc*3+1] = pPos[ix+1]; lPos[vc*3+2] = pPos[ix+2]; vc++;
          lPos[vc*3] = pPos[jx];   lPos[vc*3+1] = pPos[jx+1]; lPos[vc*3+2] = pPos[jx+2]; vc++;
        }
      }
    }

    ptGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.setDrawRange(0, vc);

    /* Icosahedron */
    icoGroup.rotation.x = t * 0.28 + mouse.y * 0.22;
    icoGroup.rotation.y = t * 0.48 + mouse.x * 0.22;
    icoGroup.position.y = 0.5 + Math.sin(t * 0.65) * 0.3;

    /* Octahedron */
    octGroup.rotation.x = -t * 0.38 + mouse.y * 0.18;
    octGroup.rotation.y = -t * 0.58 + mouse.x * 0.18;
    octGroup.position.y = -0.6 + Math.cos(t * 0.85) * 0.28;

    /* Torus */
    torusWire.rotation.x = t * 0.18;
    torusWire.rotation.z = t * 0.24;

    /* Camera subtle drift */
    camera.position.x += (mouse.x * 0.45 - camera.position.x) * 0.022;
    camera.position.y += (mouse.y * 0.3  - camera.position.y) * 0.022;

    renderer.render(scene, camera);
  }
  tick();

  /* Resize handler */
  window.addEventListener('resize', () => {
    renderer.setSize(W(), H());
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
  });

  /* Expose meshes for transfer-state effects */
  window._scene3d = { icoWire, octWire, pl1, pl2 };
})();

/* ─────────────────────────────────────────────────────────────────
   2.  UTILITIES
──────────────────────────────────────────────────────────────────*/
function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

function showToast(msg, duration = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

/* Activate a named state inside a tab panel */
function showState(panelId, stateId) {
  document.querySelectorAll(`#${panelId} .pstate`).forEach(s => s.classList.remove('active'));
  document.getElementById(stateId).classList.add('active');
}

/* Set 3D glow intensity for transfer animation */
function setTransferGlow(active, mode) {
  if (!window._scene3d) return;
  const { icoWire, octWire, pl1, pl2 } = window._scene3d;
  if (active) {
    icoWire.material.emissiveIntensity = mode === 'send' ? 0.85 : 0.15;
    octWire.material.emissiveIntensity = mode === 'recv' ? 0.85 : 0.15;
    pl1.intensity = mode === 'recv' ? 6 : 3.5;
    pl2.intensity = mode === 'send' ? 6 : 3.5;
  } else {
    icoWire.material.emissiveIntensity = 0.15;
    octWire.material.emissiveIntensity = 0.12;
    pl1.intensity = 3.5;
    pl2.intensity = 3.5;
  }
}

/* File icon by extension */
function fileIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const MAP = {
    pdf: 'file-text', zip: 'archive', gz: 'archive', rar: 'archive', '7z': 'archive',
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image',
    mp4: 'video', mkv: 'video', avi: 'video', mov: 'video', webm: 'video',
    mp3: 'music', wav: 'music', ogg: 'music', flac: 'music',
    doc: 'file-text', docx: 'file-text', odt: 'file-text',
    xls: 'file-spreadsheet', xlsx: 'file-spreadsheet',
    ppt: 'presentation', pptx: 'presentation',
    js: 'file-code', ts: 'file-code', py: 'file-code', html: 'file-code',
    css: 'file-code', json: 'file-code', sh: 'terminal',
    txt: 'file', md: 'file',
    exe: 'cpu', apk: 'smartphone'
  };
  return MAP[ext] || 'file';
}

/* ─────────────────────────────────────────────────────────────────
   3.  TAB SWITCHER
──────────────────────────────────────────────────────────────────*/
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${tab}-panel`).classList.add('active');
  });
});

/* ─────────────────────────────────────────────────────────────────
   4.  FILE SELECTION & FILE LIST RENDER
──────────────────────────────────────────────────────────────────*/
let selectedFiles = [];
let isZip = false; // true when user explicitly picked a .zip

const dropZone   = document.getElementById('drop-zone');
const fileInput  = document.getElementById('file-input');
const zipInput   = document.getElementById('zip-input');
const fileListEl = document.getElementById('file-list');
const zipNotice  = document.getElementById('zip-notice');
const genActions = document.getElementById('generate-actions');

/* Browse Files button */
document.getElementById('browse-btn').addEventListener('click', e => {
  e.stopPropagation();
  isZip = false;
  fileInput.click();
});

/* Browse ZIP button */
document.getElementById('browse-zip-btn').addEventListener('click', e => {
  e.stopPropagation();
  isZip = true;
  zipInput.click();
});

fileInput.addEventListener('change', () => {
  isZip = false;
  selectedFiles = Array.from(fileInput.files);
  renderFileList();
});

zipInput.addEventListener('change', () => {
  isZip = true;
  selectedFiles = Array.from(zipInput.files);
  renderFileList();
});

/* Drag & Drop */
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files);
  if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
    isZip = true;
  } else {
    isZip = false;
  }
  selectedFiles = files;
  renderFileList();
});

function renderFileList() {
  if (!selectedFiles.length) return;

  const multiNonZip = !isZip && selectedFiles.length > 1;

  fileListEl.style.display = 'flex';
  fileListEl.innerHTML = '';
  selectedFiles.forEach(f => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <div class="fi-icon"><i data-lucide="${fileIcon(f.name)}"></i></div>
      <div class="fi-info">
        <div class="fi-name">
          ${escHtml(f.name)}
          ${isZip ? '<span class="zip-tag">ZIP</span>' : ''}
        </div>
        <div class="fi-size">${fmtBytes(f.size)}</div>
      </div>
    `;
    fileListEl.appendChild(item);
  });

  lucide.createIcons(); // re-init icons for dynamically added elements

  zipNotice.style.display = multiNonZip ? 'flex' : 'none';
  genActions.style.display = 'block';
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ─────────────────────────────────────────────────────────────────
   5.  WEBRTC / PEERJS — SENDER
──────────────────────────────────────────────────────────────────*/
const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk

let senderPeer = null;

document.getElementById('generate-btn').addEventListener('click', async () => {
  if (!selectedFiles.length) { showToast('Select files first.'); return; }

  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2"></i> Preparing…';
  lucide.createIcons();

  /* ── Determine file to send ──────────────────────────── */
  let fileToSend;

  if (isZip || selectedFiles.length === 1) {
    /* Single file OR user-uploaded zip → send as-is */
    fileToSend = selectedFiles[0];
  } else {
    /* Multiple files → zip client-side with JSZip */
    showToast('Zipping files, please wait…');
    try {
      const zip = new JSZip();
      selectedFiles.forEach(f => zip.file(f.name, f));
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      const totalOriginal = selectedFiles.reduce((s, f) => s + f.size, 0);
      const zipName = selectedFiles.length > 1
        ? `infrequent_${Date.now()}.zip`
        : selectedFiles[0].name + '.zip';
      fileToSend = new File([blob], zipName, { type: 'application/zip' });
      showToast(`Zipped: ${fmtBytes(totalOriginal)} → ${fmtBytes(fileToSend.size)}`);
    } catch (err) {
      showToast('Failed to zip files: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="link-2"></i> Generate Room ID & Share';
      lucide.createIcons();
      return;
    }
  }

  /* ── Create PeerJS peer ──────────────────────────────── */
  if (senderPeer) senderPeer.destroy();
  senderPeer = new Peer();

  senderPeer.on('open', id => {
    /* Show Room ID */
    document.getElementById('room-id-text').textContent = id;

    /* Generate QR code — encodes URL with ?room= param so mobiles can deep-link */
    const qrUrl = `${location.origin}${location.pathname}?room=${encodeURIComponent(id)}`;
    const qrContainer = document.getElementById('qr-container');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: qrUrl,
      width: 160,
      height: 160,
      colorDark:  '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });

    showState('send-panel', 'state-room');

    /* Wait for receiver */
    senderPeer.on('connection', conn => {
      conn.on('open', () => {
        /* Force binary type — prevents Blob delivery on some browsers */
        if (conn.dataChannel) conn.dataChannel.binaryType = 'arraybuffer';
        startSending(conn, fileToSend);
      });
      conn.on('error', err => {
        showToast('Connection error: ' + err.type);
        console.error('[Sender conn error]', err);
      });
    });
  });

  senderPeer.on('error', err => {
    showToast('Peer error: ' + err.type);
    console.error('[Sender peer error]', err);
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="link-2"></i> Generate Room ID & Share';
    lucide.createIcons();
  });
});

function startSending(conn, file) {
  document.getElementById('send-filename').textContent = file.name;
  showState('send-panel', 'state-transfer-send');
  setTransferGlow(true, 'send');

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  /* Send metadata first (JSON string — PeerJS raw mode passes strings as-is) */
  conn.send(JSON.stringify({
    type: 'meta',
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    totalChunks
  }));

  /* Use async/await with Blob.arrayBuffer() — avoids FileReader callback
     race conditions and guarantees sequential chunk delivery */
  let offset    = 0;
  let bytesSent = 0;
  let seq       = 0;          // chunk sequence number
  const t0      = Date.now();

  async function sendNextChunk() {
    if (offset >= file.size) {
      conn.send(JSON.stringify({ type: 'done' }));
      setTransferGlow(false);
      showState('send-panel', 'state-send-done');
      return;
    }

    const slice = file.slice(offset, offset + CHUNK_SIZE);

    /* Blob.arrayBuffer() is the modern, non-callback way to read binary —
       awaiting here ensures strict sequential sending */
    const ab = await slice.arrayBuffer();

    /* Prepend a 4-byte sequence number to each chunk so the receiver can
       detect and reject out-of-order delivery (safety net) */
    const packet = new Uint8Array(4 + ab.byteLength);
    new DataView(packet.buffer).setUint32(0, seq, false); // big-endian seq
    packet.set(new Uint8Array(ab), 4);

    conn.send(packet.buffer);
    offset    += ab.byteLength;
    bytesSent += ab.byteLength;
    seq++;

    /* Update UI */
    const pct = Math.min(100, Math.round((offset / file.size) * 100));
    document.getElementById('send-progress-fill').style.width = pct + '%';
    document.getElementById('send-pct').textContent = pct + '%';

    const elapsed = (Date.now() - t0) / 1000 || 0.001;
    document.getElementById('send-speed').textContent = fmtBytes(bytesSent / elapsed) + '/s';

    /* Flow control: pause if DataChannel buffer is filling up */
    const dc = conn.dataChannel;
    if (dc && dc.bufferedAmount > 3 * 1024 * 1024) {
      await drainBuffer(dc);
    }

    sendNextChunk();
  }

  sendNextChunk();
}

/* Promisified buffer drain — waits until bufferedAmount drops below 512KB */
function drainBuffer(dc) {
  return new Promise(resolve => {
    function check() {
      if (dc.bufferedAmount < 512 * 1024) resolve();
      else setTimeout(check, 50);
    }
    check();
  });
}


/* Copy Room ID */
document.getElementById('copy-btn').addEventListener('click', () => {
  const id = document.getElementById('room-id-text').textContent;
  if (!id) return;
  navigator.clipboard.writeText(id)
    .then(() => showToast('✓ Room ID copied!'))
    .catch(() => {
      /* Fallback for older browsers */
      const ta = document.createElement('textarea');
      ta.value = id;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('✓ Room ID copied!');
    });
});

/* Cancel Room */
document.getElementById('cancel-room-btn').addEventListener('click', () => {
  if (senderPeer) { senderPeer.destroy(); senderPeer = null; }
  showState('send-panel', 'state-select');
  const btn = document.getElementById('generate-btn');
  btn.disabled = false;
  btn.innerHTML = '<i data-lucide="link-2"></i> Generate Room ID & Share';
  lucide.createIcons();
});

/* Send Again */
document.getElementById('send-again-btn').addEventListener('click', () => {
  selectedFiles = [];
  isZip = false;
  fileListEl.style.display = 'none';
  fileListEl.innerHTML = '';
  zipNotice.style.display = 'none';
  genActions.style.display = 'none';
  if (senderPeer) { senderPeer.destroy(); senderPeer = null; }
  showState('send-panel', 'state-select');

  const btn = document.getElementById('generate-btn');
  btn.disabled = false;
  btn.innerHTML = '<i data-lucide="link-2"></i> Generate Room ID & Share';
  lucide.createIcons();
});

/* ─────────────────────────────────────────────────────────────────
   6.  WEBRTC / PEERJS — RECEIVER
──────────────────────────────────────────────────────────────────*/
let receiverPeer   = null;
let recvMeta       = null;
let recvChunks     = [];        // used only in Blob-fallback mode
let recvBytes      = 0;
let recvT0         = null;
let expectedSeq    = 0;         // chunk sequence counter

/* StreamSaver state */
let recvWriter     = null;      // WritableStreamDefaultWriter (stream mode)
let recvMode       = 'buffer';  // 'stream' | 'buffer'

/* ── Init StreamSaver mitm path ─────────────────────────────── */
if (window.streamSaver) {
  /* mitm.html is needed by Firefox / older Chrome (acts as a service-worker
     proxy). Modern Chrome/Edge use the native File System Access API and
     never need mitm at all.                                              */
  streamSaver.mitm =
    'https://cdn.jsdelivr.net/npm/streamsaver@2.0.6/examples/mitm.html';
}

/* ── Helper: choose streaming vs buffer mode ────────────────── */
function openReceiveStream(meta) {
  if (window.streamSaver) {
    try {
      const fileStream = streamSaver.createWriteStream(meta.name, {
        size: meta.size   // lets browser show accurate progress in download bar
      });
      recvWriter = fileStream.getWriter();
      recvMode   = 'stream';
      recvChunks = [];
      console.info('[Recv] StreamSaver active — writing directly to disk 🚀');
      return;
    } catch (e) {
      console.warn('[Recv] StreamSaver.createWriteStream failed, using Blob fallback:', e);
    }
  }
  /* Fallback — buffer everything in RAM then download as Blob */
  recvWriter = null;
  recvMode   = 'buffer';
  recvChunks = [];
  console.info('[Recv] Blob-buffer mode (StreamSaver unavailable)');
}

/* ── Helper: abort an in-progress stream cleanly ────────────── */
function abortReceiveStream() {
  if (recvWriter) {
    recvWriter.abort().catch(() => {});
    recvWriter = null;
  }
  recvMode   = 'buffer';
  recvChunks = [];
}

document.getElementById('connect-btn').addEventListener('click', () => {
  const roomId = document.getElementById('room-input').value.trim();
  if (!roomId) { showToast('Enter a Room ID first.'); return; }

  /* Reset receiver state */
  abortReceiveStream();
  recvMeta    = null;
  recvBytes   = 0;
  expectedSeq = 0;

  showState('receive-panel', 'state-connecting');

  if (receiverPeer) receiverPeer.destroy();
  receiverPeer = new Peer();

  receiverPeer.on('open', () => {
    /* serialization:'raw' bypasses PeerJS msgpack encoding — the #1 cause
       of cross-device binary corruption. In raw mode:
         strings      → sent as UTF-8 strings  (metadata JSON)
         ArrayBuffer  → sent as raw binary      (file chunks)            */
    const conn = receiverPeer.connect(roomId, {
      reliable: true,
      serialization: 'raw'
    });

    conn.on('open', () => {
      /* Force arraybuffer mode — prevents Blob delivery on Safari/mobile */
      if (conn.dataChannel) conn.dataChannel.binaryType = 'arraybuffer';
      showToast('Connected! Waiting for file…');
    });

    conn.on('data', data => handleRecvData(data));

    conn.on('error', err => {
      showToast('Connection error: ' + err.type);
      console.error('[Recv conn error]', err);
      abortReceiveStream();
      showState('receive-panel', 'state-enter-room');
    });

    conn.on('close', () => {
      if (recvMeta && recvBytes < recvMeta.size) {
        showToast('Connection closed before transfer finished.');
        abortReceiveStream();
        showState('receive-panel', 'state-enter-room');
      }
    });
  });

  receiverPeer.on('error', err => {
    showToast('Could not connect. Check Room ID. (' + err.type + ')');
    console.error('[Recv peer error]', err);
    showState('receive-panel', 'state-enter-room');
  });
});

function handleRecvData(data) {
  /* ── JSON control messages (string) ──────────────────────── */
  if (typeof data === 'string') {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    if (msg.type === 'meta') {
      recvMeta    = msg;
      recvBytes   = 0;
      expectedSeq = 0;
      recvT0      = Date.now();

      /* Open streaming write-to-disk (or Blob fallback) */
      openReceiveStream(msg);

      document.getElementById('recv-filename').textContent =
        msg.name + '  (' + fmtBytes(msg.size) + ')';

      /* Show mode badge in UI */
      const modeLabel = recvMode === 'stream'
        ? '💾 Streaming to disk — no RAM limit'
        : '📦 Buffering in RAM';
      showToast(modeLabel, 3000);

      showState('receive-panel', 'state-transfer-recv');
      setTransferGlow(true, 'recv');

    } else if (msg.type === 'done') {

      if (recvMode === 'stream' && recvWriter) {
        /* Close the writable stream — StreamSaver finishes the download */
        recvWriter.close()
          .then(() => { console.info('[Recv] Stream closed ✓'); })
          .catch(e => console.error('[Recv] Stream close error:', e));
        recvWriter = null;

      } else {
        /* Blob fallback: assemble all buffered chunks and trigger download */
        const mimeType = recvMeta ? recvMeta.mimeType : 'application/octet-stream';
        const blob     = new Blob(recvChunks, { type: mimeType });
        const url      = URL.createObjectURL(blob);
        const anchor   = document.createElement('a');
        anchor.href          = url;
        anchor.download      = recvMeta ? recvMeta.name : 'download';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(() => { URL.revokeObjectURL(url); anchor.remove(); }, 5000);
        recvChunks = [];
      }

      document.getElementById('recv-done-meta').textContent =
        recvMeta ? `${recvMeta.name}  ·  ${fmtBytes(recvMeta.size)}` : 'File received';
      setTransferGlow(false);
      showState('receive-panel', 'state-recv-done');
    }
    return;
  }

  /* ── Binary chunk (ArrayBuffer / TypedArray / Blob) ─────── */
  let ab;
  if (data instanceof ArrayBuffer) {
    ab = data;
  } else if (ArrayBuffer.isView(data)) {
    ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } else if (data instanceof Blob) {
    /* Last-resort: queue Blobs and process FIFO (preserves order) */
    recvBlobQueue.push(data);
    if (!recvBlobProcessing) processBlobQueue();
    return;
  } else {
    console.warn('[Recv] Unknown data type:', typeof data, data);
    return;
  }

  processChunk(ab);
}

/* ── processChunk: strip seq header → write to disk or buffer ─ */
function processChunk(ab) {
  if (ab.byteLength < 4) {
    console.warn('[Recv] Chunk too small to contain seq header:', ab.byteLength);
    return;
  }

  const view    = new DataView(ab);
  const seq     = view.getUint32(0, false);  // big-endian sequence number
  const payload = ab.slice(4);               // actual file bytes

  /* Sequence validation — should never fire with reliable DataChannel */
  if (seq !== expectedSeq) {
    console.error(`[Recv] Out-of-order! expected=${expectedSeq} got=${seq}`);
    showToast(`⚠️ Chunk order error at seq ${seq}`);
  }
  expectedSeq++;

  /* ── Route chunk: disk stream or RAM buffer ─────────────── */
  if (recvMode === 'stream' && recvWriter) {
    /* WritableStream queues writes internally — FIFO, no await needed.
       The stream handles backpressure against the disk automatically.  */
    recvWriter.write(new Uint8Array(payload));
  } else {
    recvChunks.push(payload);
  }

  recvBytes += payload.byteLength;

  /* Update progress UI */
  const pct = recvMeta
    ? Math.min(100, Math.round((recvBytes / recvMeta.size) * 100))
    : 0;
  document.getElementById('recv-progress-fill').style.width = pct + '%';
  document.getElementById('recv-pct').textContent = pct + '%';

  const elapsed = Math.max((Date.now() - recvT0) / 1000, 0.001);
  document.getElementById('recv-speed').textContent =
    fmtBytes(recvBytes / elapsed) + '/s';
}

/* ── Blob fallback queue — FIFO async processing ─────────────── */
const recvBlobQueue      = [];
let   recvBlobProcessing = false;

async function processBlobQueue() {
  recvBlobProcessing = true;
  while (recvBlobQueue.length > 0) {
    const blob = recvBlobQueue.shift();
    const ab   = await blob.arrayBuffer(); // one at a time → strict order
    processChunk(ab);
  }
  recvBlobProcessing = false;
}

/* Receive Again */
document.getElementById('recv-again-btn').addEventListener('click', () => {
  document.getElementById('room-input').value = '';
  abortReceiveStream();
  recvMeta    = null;
  recvBytes   = 0;
  expectedSeq = 0;
  recvBlobQueue.length = 0;
  recvBlobProcessing   = false;
  if (receiverPeer) { receiverPeer.destroy(); receiverPeer = null; }
  showState('receive-panel', 'state-enter-room');
});



/* ─────────────────────────────────────────────────────────────────
   7.  QR CODE DEEP LINK  — auto-fill Room ID from URL ?room=
──────────────────────────────────────────────────────────────────*/
(function handleDeepLink() {
  const params  = new URLSearchParams(window.location.search);
  const roomId  = params.get('room');
  if (!roomId) return;

  /* Switch to Receive tab */
  document.querySelector('[data-tab="receive"]').click();

  /* Fill in Room ID */
  document.getElementById('room-input').value = roomId;

  showToast('Room ID filled from QR code — click Connect!', 4000);

  /* Clean up URL without reload */
  history.replaceState(null, '', location.pathname);
})();

/* ─────────────────────────────────────────────────────────────────
   8.  QR CAMERA SCANNER  (jsQR + getUserMedia)
──────────────────────────────────────────────────────────────────*/
(function initQRScanner() {
  const overlay    = document.getElementById('scanner-overlay');
  const video      = document.getElementById('scanner-video');
  const statusEl   = document.getElementById('scanner-status');
  const camSelect  = document.getElementById('camera-select');
  const viewport   = document.getElementById('scanner-viewport');

  let stream       = null;
  let rafId        = null;
  let scanning     = false;
  let offscreenCtx = null;
  let offscreenCvs = null;

  /* ── Open scanner ──────────────────────────────────────── */
  document.getElementById('scan-qr-btn').addEventListener('click', () => {
    openScanner();
  });

  /* ── Close scanner ─────────────────────────────────────── */
  document.getElementById('close-scanner-btn').addEventListener('click', () => {
    closeScanner();
  });

  /* Close on overlay backdrop click */
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeScanner();
  });

  /* Escape key closes scanner */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) closeScanner();
  });

  /* Camera select dropdown change */
  camSelect.addEventListener('change', () => {
    stopStream();
    startStream(camSelect.value);
  });

  /* ── Core functions ────────────────────────────────────── */
  async function openScanner() {
    /* Check jsQR is loaded */
    if (typeof jsQR === 'undefined') {
      showToast('QR scanner library not loaded. Check your internet connection.');
      return;
    }

    overlay.classList.add('active');
    setStatus('camera', 'Starting camera…');

    /* Enumerate cameras */
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams    = devices.filter(d => d.kind === 'videoinput');

      if (cams.length > 1) {
        camSelect.innerHTML = cams.map((c, i) =>
          `<option value="${c.deviceId}">${c.label || 'Camera ' + (i + 1)}</option>`
        ).join('');
        camSelect.style.display = 'block';
      } else {
        camSelect.style.display = 'none';
      }

      /* Prefer rear camera on mobile */
      const rearCam  = cams.find(c => /back|rear|environment/i.test(c.label));
      const deviceId = rearCam ? rearCam.deviceId : (cams[0] ? cams[0].deviceId : undefined);

      await startStream(deviceId);

    } catch (err) {
      handleCameraError(err);
    }
  }

  async function startStream(deviceId) {
    try {
      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment',     width: { ideal: 1280 }, height: { ideal: 720 } }
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      await video.play();

      setStatus('camera', 'Scanning…');

      /* Build offscreen canvas once */
      offscreenCvs = document.createElement('canvas');
      offscreenCtx = offscreenCvs.getContext('2d', { willReadFrequently: true });

      scanning = true;
      rafId    = requestAnimationFrame(scanFrame);

    } catch (err) {
      handleCameraError(err);
    }
  }

  function stopStream() {
    scanning = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    video.srcObject = null;
  }

  function closeScanner() {
    stopStream();
    overlay.classList.remove('active');
    camSelect.style.display = 'none';
    setStatus('camera', 'Scanning…');
    statusEl.classList.remove('found');
    viewport.classList.remove('detected');
  }

  /* ── Per-frame QR detection ────────────────────────────── */
  function scanFrame() {
    if (!scanning) return;

    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      rafId = requestAnimationFrame(scanFrame);
      return;
    }

    const w = video.videoWidth;
    const h = video.videoHeight;

    if (w === 0 || h === 0) {
      rafId = requestAnimationFrame(scanFrame);
      return;
    }

    offscreenCvs.width  = w;
    offscreenCvs.height = h;
    offscreenCtx.drawImage(video, 0, 0, w, h);

    const imageData = offscreenCtx.getImageData(0, 0, w, h);
    const code      = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });

    if (code && code.data) {
      onQRDetected(code.data);
    } else {
      rafId = requestAnimationFrame(scanFrame);
    }
  }

  /* ── QR code found! ────────────────────────────────────── */
  function onQRDetected(raw) {
    scanning = false;

    /* Extract room ID — the QR may encode a full URL or just the raw peer ID */
    let roomId = raw.trim();
    try {
      const url = new URL(raw);
      const rid = url.searchParams.get('room');
      if (rid) roomId = rid;
    } catch { /* raw text is the room ID itself */ }

    /* Visual feedback */
    setStatus('check-circle-2', '✓ QR code detected!');
    statusEl.classList.add('found');
    viewport.classList.add('detected');
    lucide.createIcons(); // re-render icon in status

    /* Stop camera after short delay (so user sees the "found" state) */
    setTimeout(() => {
      closeScanner();

      /* Fill in Room ID on receive panel */
      document.getElementById('room-input').value = roomId;

      /* Make sure receive tab is active */
      const recvTab = document.querySelector('[data-tab="receive"]');
      if (!recvTab.classList.contains('active')) recvTab.click();

      showToast('✓ QR scanned! Click Connect to proceed.', 3500);
    }, 700);
  }

  /* ── Error handling ────────────────────────────────────── */
  function handleCameraError(err) {
    console.error('[QR Scanner]', err);

    let msg = 'Camera error.';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      msg = 'Camera permission denied. Please allow camera access in your browser.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      msg = 'No camera found on this device.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      msg = 'Camera is in use by another app.';
    } else if (err.name === 'OverconstrainedError') {
      msg = 'Camera constraints not satisfied. Trying default camera…';
      startStream(undefined);
      return;
    }

    setStatus('alert-triangle', msg);
    showToast(msg, 4000);
  }

  /* ── Status helper ─────────────────────────────────────── */
  function setStatus(icon, text) {
    statusEl.innerHTML = `<i data-lucide="${icon}"></i><span>${text}</span>`;
    lucide.createIcons();
  }
})();