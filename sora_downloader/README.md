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

node index.js --url https://sora.chatgpt.com/explore/ --auth-file token.txt

node index.js --url https://sora.chatgpt.com/p/s_68e3ba6530ac8191a3e1fed0e939dbd4 --auth-file token.txt --device-id 9d8b579c-3074-44c0-a3f2-69be5ec1ce9f

node index.js --url https://sora.chatgpt.com/p/s_68e3da7c3a0881919869e731583da431 --auth-file token.txt --device-id d7260893-5856-41a4-b721-363f2b52660c


```

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
