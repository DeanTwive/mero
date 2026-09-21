const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8085;
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4'
};

// SSE Clients for Live Reload
const sseClients = new Set();

// Client-side script injected into HTML for instant live reload
const LIVE_RELOAD_SCRIPT = `
<!-- Mero Live Reload -->
<script>
(function() {
  const es = new EventSource('/live-reload');
  es.onmessage = function(e) {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'css') {
        console.log('[LiveReload] Hot updating CSS styles...');
        document.querySelectorAll('link[rel="stylesheet"]').forEach(function(link) {
          const url = new URL(link.href, location.origin);
          url.searchParams.set('_v', Date.now());
          link.href = url.toString();
        });
      } else {
        console.log('[LiveReload] Code changed (' + (data.file || 'update') + '). Refreshing immediately...');
        location.reload();
      }
    } catch(err) {
      location.reload();
    }
  };
  es.onerror = function() {
    // Reconnection is handled automatically by EventSource
  };
})();
</script>
`;

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // SSE endpoint for live reload
  if (pathname === '/live-reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('data: {"type":"connected"}\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(__dirname, pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // For HTML, inject live reload script before </body>
    if (ext === '.html') {
      fs.readFile(filePath, 'utf8', (readErr, content) => {
        if (readErr) {
          res.writeHead(500);
          res.end('500 Error reading file');
          return;
        }
        let injected = content;
        if (injected.includes('</body>')) {
          injected = injected.replace('</body>', `${LIVE_RELOAD_SCRIPT}\n</body>`);
        } else {
          injected += LIVE_RELOAD_SCRIPT;
        }
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(injected);
      });
      return;
    }

    // Static assets
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

// Watch directory for instant live reload
let debounceTimer = null;
function notifyClients(changedFile) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const ext = path.extname(changedFile).toLowerCase();
    const isCss = ext === '.css';
    const payload = JSON.stringify({
      type: isCss ? 'css' : 'full',
      file: path.basename(changedFile)
    });

    console.log(`[Watcher] File modified: ${changedFile} -> Broadcasting reload to ${sseClients.size} client(s)`);
    for (const client of sseClients) {
      client.write(`data: ${payload}\n\n`);
    }
  }, 80);
}

// Set up file watchers
const watchDirs = ['.', './css', './js'];
watchDirs.forEach(dir => {
  const absDir = path.join(__dirname, dir);
  if (fs.existsSync(absDir)) {
    try {
      fs.watch(absDir, { recursive: true }, (eventType, filename) => {
        if (filename) {
          const ext = path.extname(filename).toLowerCase();
          if (['.html', '.css', '.js', '.json'].includes(ext)) {
            notifyClients(filename);
          }
        }
      });
    } catch (e) {
      // Fallback for non-recursive watch
      fs.watch(absDir, (eventType, filename) => {
        if (filename) {
          notifyClients(filename);
        }
      });
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`⚡ Mero Live-Reload Server Running at: http://localhost:${PORT}`);
  console.log(`⚡ Watching for code changes in: HTML, CSS, JS`);
  console.log(`======================================================\n`);
});
