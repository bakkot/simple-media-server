# simple-media-server

A single-file server.

Basically just a fancy `npx http-server`, but with support for downloading entire directories as `.tar` files. No built-in player or anything like that.

If you want a real server, use Jellyfin or something. I wanted something a little smarter than `http-server` but still be simple enough to customize myself.

## Running

- Install node
- Clone repo
- Edit the `let dirs` binding to have whatever mapping you want
- `npm install` to install dependencies
- `node index.js` to run
