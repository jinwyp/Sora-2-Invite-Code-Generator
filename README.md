# Sora Invite Code Brute Force Tool

This Node.js script attempts to find valid invite codes for a Sora account by generating random 6-character codes and testing them against the Sora backend API.

## Prerequisites

- **Node.js**: Ensure Node.js is installed on your system.
- **Dependencies**: Install required packages by running:

  ```bash
  npm install axios dotenv
  ```

## Configuration

Create a `.env` file in the project root with your authorization header:

```env
HTTP_AUTHORIZATION_HEADER=Bearer your_token_here
```

## Running Locally

```bash
npm install
node index.js
```

## Running with GitHub Actions

This repository includes a GitHub Actions workflow that can be manually triggered to run the invite code generator.

### Setup

1. Ensure your `.env` file with valid `HTTP_AUTHORIZATION_HEADER` is committed to the repository
2. The `.env` file is tracked in git for GitHub Actions to use

### Manual Trigger

1. Navigate to the **Actions** tab in your GitHub repository
2. Select **Run Invite Code Generator** workflow from the left sidebar
3. Click **Run workflow** button
4. Optionally adjust the batch count parameter
5. Click the green **Run workflow** button to start

The workflow will:
- Checkout the repository (including `.env` file)
- Install dependencies
- Run the invite code generator using the `.env` configuration
- Automatically commit and push any new success codes and tried codes back to the repository

## Output files

- `tried_codes.json`: Records invite codes that returned a 403 response so they are not retried in future executions.
- `success_codes_YYYYMMDD.json`: Stores successful invite codes tagged with the run date in UTC (for example, `success_codes_20251004.json`). Legacy `success_codes.json` files are migrated automatically when a new success is recorded.