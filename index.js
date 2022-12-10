'use strict';

let path = require('path');
let fs = require('fs');

let express = require('express');
let tarstream = require('tar-stream');

let hostname = '0.0.0.0';
let port = 8192;

let dirs = {
  __proto__: null,
  'Music': '/some/path/music',
};

/*
icons from https://lucide.dev/
see also https://feathericons.com/
icons are used under the following license:

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/
let blankIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"></svg>`;
let videoIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`;
let folderIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path></svg>`;
let bookIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`;
let musicIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
let saveDirIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path><path d="M12 10v6"></path><path d="m15 13-3 3-3-3"></path></svg>`;
let unknownIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;

let mappings = {
  __proto__: null,
  '.mp4': videoIcon,
  '.mkv': videoIcon,
  '.avi': videoIcon,
  '.ogm': videoIcon,
  '.epub': bookIcon,
  '.mobi': bookIcon,
  '.azw3': bookIcon,
  '.mp3': musicIcon,
};

let app = express();

for (let [name, dir] of Object.entries(dirs)) {
  app.use('/' + name, express.static(dir));
}

app.get('/', (req, res) => {
  let title = 'Media';
  let listing = Object.keys(dirs).map(x => 
    `<span class='item'>${folderIcon} <a href="${san(`${x}`)}">${x}</a></span>`
  ).join('<br>');
  res.send(page({ title: 'Media', body: `<h2>Media</h2>\n${listing}` }));
});

app.get('*', (req, res) => {
  let p = req.baseUrl + req.path;
  let base = p.split('/')[1];
  if (!dirs[base]) {
    res.status(404).send('404 Not Found');
    return;
  }
  let dir = dirs[base];
  let subdir = decodeURIComponent(p.slice(p.indexOf('/', 1) + 1));
  let fullPath = path.join(dir, subdir);

  // prevent directory traversal
  let resolved = path.relative(dir, fullPath);
  if (resolved.startsWith('..') || path.isAbsolute(resolved)) {
    res.send('no funny business');
    return;
  }

  if (!fs.existsSync(fullPath)) {
    res.status(404).send('404 Not Found');
    return;
  }

  if ('tar' in req.query) {
    let stream = tarstream.pack();
    let totalSize = 1024; // tar has 1024 trailing null bytes
    let promise = Promise.resolve();
    function walk(dir, prefix) {
      let contents = fs.readdirSync(dir, { withFileTypes: true })
        .filter(x => !x.name.startsWith('.'));
      for (let item of contents) {
        if (item.isDirectory()) continue;
        let localName = path.join(dir, item.name);
        let size = fs.lstatSync(localName).size;
        totalSize += 512 + size; // header is 512 bytes
        if ((size & 511) !== 0) {
          totalSize += (512 - (size & 511)); // actual size is rounded up to a multiple of 512
        }
        let tarName = prefix + item.name;
        promise = promise.then(() => addFileToStream(stream, localName, tarName, size));
      }
      for (let item of contents) {
        if (!item.isDirectory()) continue;
        let localName = path.join(dir, item.name);
        walk(localName, prefix + item.name + '/');
      }
    }
    walk(fullPath, '');
    promise.then(() => {
      stream.finalize();
    }).catch(err => {
      console.log({ err });
      res.status(500).send(err);
    });
    res
      .set('Content-Type', 'application/tar')
      .set('Content-Length', totalSize)
      .set('Content-Disposition', `attachment; filename="${p.split('/').at(-2).replace(/["\.]/g, '_')}.tar"`);

    stream
      .pipe(res);
    return;
  }

  if (fs.lstatSync(fullPath).isDirectory()) {
    let contents = fs.readdirSync(fullPath, { withFileTypes: true })
      .filter(x => !x.name.startsWith('.'));
    contents.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
    let listing = contents.map(x => {
      let icon = unknownIcon;
      if (x.isDirectory()) {
        icon = folderIcon;
      } else {
        let ext = path.extname(x.name);
        if (mappings[ext]) {
          icon = mappings[ext];
        }
      }
      let v = san(x.name);
      return `<span class='item'>${icon} <a href="${v}">${v}</a></span>`;
    }).join('<br>');
    let title = base;
    if (subdir) {
      title += '/' + (subdir.endsWith('/') ? subdir.slice(0, -1) : '')
    }
    res.send(page({ title, body: `<h2>${title} <a href="..">↩</a></h2>\n<a href="?tar">${saveDirIcon} Download entire directory</a><br><br>\n${listing}` }));
  } else {
    res.send('this should not be reachable');
  }
});

app.listen(port, hostname, () => {
  console.log(`Media server listening on http://${hostname}:${port}`)
});

function san(html) {
  return html.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

let page = ({ title, body }) => `
<!doctype html>
<html lang='en'>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
  html {
    padding: 1em;
    margin: auto;
    line-height: 1.5;
    font-size: 1.1em;
  }
  h2 {
    margin-top: 0em;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  svg {
    vertical-align: text-top;
  }
  </style>
</head>
<body>
${body}
`.trim();

// https://github.com/mafintosh/tar-stream/issues/76
function addFileToStream(stream, localName, tarName, size) {
  return new Promise((resolve, reject) => {
    let entry = stream.entry({
      name: tarName,
      size
    }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });

    fs.createReadStream(localName)
      .pipe(entry);
  });
}
