# Sora Explore Video Downloader

A command-line utility for downloading video assets from `https://sora.chatgpt.com/explore` pages. The tool reuses the authorization token from your browser session, fetches the explore page markup, discovers video sources, and downloads them locally.

## Prerequisites

- Node.js 20.14.0 or newer (20.18.1+ recommended for best compatibility)
- An active Sora session token copied from your browser (`Authorization` header)

## Installation

From the `sora_downloader` directory, install dependencies:

```bash
npm install
```

(When running from the repository root use `npm install --prefix sora_downloader`.)

## Authentication

Set your authorization header via one of the following methods:

1. Environment variable:
   ```bash
   setx SORA_AUTH_TOKEN "Bearer eyJhbGciOi..."
   ```
   Or place the same value in `HTTP_AUTHORIZATION_HEADER`.
2. Command-line option:
   ```bash
   node index.js --url <...> --auth "Bearer eyJhbGciOi..."
   ```
3. Token file:
   ```bash
   node index.js --url <...> --auth-file token.txt
   ```

The string should include the leading `Bearer ` prefix. The tool will add it automatically if omitted.

## Usage

```bash

node index.js --auth-file token.txt 

node index.js --auth-file token.txt --device-id d439c49e-4d7f-48e0-98e8-6025343e719c --url https://sora.chatgpt.com/p/s_68e4c4f45b748191827439c9e56e83cc

node index.js --cookie-file cookies.txt  --url https://sora.chatgpt.com/p/s_68df7baf0d9481919c386892e5085d71

node index2.js --cookie-file cookies.txt --auth-file token.txt --url https://sora.chatgpt.com/p/s_68e5f48d95a08191975ce1ca47b863e4



```

### Working with browser cookies

If you copy the `Cookie` header from your browser developer tools, you can convert it into the array format required by tooling such as Puppeteer:

```js
const { getCookieArray } = require('./utils');

(async () => {
   const cookies = await getCookieArray('cookies.txt');
   console.log(cookies);
})();
```

`getCookieArray` assumes the cookies belong to `sora.chatgpt.com`, sets the path to `/`, and marks every cookie as `secure` and `httpOnly`. You can override these defaults by passing an options object, for example `getCookieArray('cookies.txt', { secure: false })`.

Common options:

| Option | Description |
| ------ | ----------- |
| `--output`, `-o` | Output file or directory. Defaults to `./downloads/<slug>.mp4`. |
| `--auth`, `-a` | Authorization header value (overrides env). |
| `--auth-file` | Path to a file containing the authorization header. |
| `--all` | Download every video source found on the page. |
| `--index`, `-i` | Download a specific zero-based video index. |
| `--dry-run` | Print discovered video URLs without downloading. |
| `--verbose`, `-v` | Show download progress for large files. |

Example – download all sources into a folder:

```bash
node index.js \
  --url https://sora.chatgpt.com/explore/robot-librarian \
  --output ./sora_videos \
  --all --verbose
```

To install globally and create the `sora-downloader` executable:

```bash
npm install -g .
```

After global installation you can run:

```bash
sora-downloader --url https://sora.chatgpt.com/explore/<slug>
```

## Troubleshooting

- **401 Unauthorized** – Refresh your token from the browser and update the `--auth` argument or environment variable.
- **403 Forbidden** – The video may be private or the token lacks access. Double-check the URL and token.
- **429 Too Many Requests** – Wait a few minutes to respect the server rate limits.
- **No video sources found** – The explore page structure may have changed. Use `--dry-run` to inspect any detected URLs and open an issue with the HTML snippet if needed.

WZXQ3N
YPDGZ8

