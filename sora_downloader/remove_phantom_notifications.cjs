const { exec } = require("node:child_process");
const { basename } = require("node:path");

function runShellCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stderr });
        return;
      }
      resolve(stdout);
    });
  });
}

let _githubToken = "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";
async function getGithubToken() {
  if (!_githubToken) {
    _githubToken = await runShellCommand("gh auth token");
  }
  return _githubToken;
}

async function getNotifications(since) {
  const response = await fetch(`https://api.github.com/notifications?all=true&since=${since}`, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${await getGithubToken()}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  return response.json();
}

async function shouldIncludeNotificationForRemoval(notification) {
  try {
    const response = await fetch(`https://api.github.com/repos/${notification.repository.full_name}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${await getGithubToken()}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    return response.status === 404;
  } catch (error) {
    console.log("threw");
    if (error.code && error.code === 404) {
      return true;
    }
    console.error(error);
    throw error;
  }
}

async function markNotificationRead(notification) {
  const response = await fetch(notification.url, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${await getGithubToken()}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    console.error(`Failed to mark notification with thread URL ${notification.url} from repo ${notification.repository.full_name} as read: ${response.status} ${response.statusText}`);
  }
}
async function markNotificationDone(notification) {
  const response = await fetch(notification.url, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${await getGithubToken()}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    console.error(`Failed to mark notification with thread URL ${notification.url} from repo ${notification.repository.full_name} as done: ${response.status} ${response.statusText}`);
  }
}

async function unsubscribe(notification) {
  const response = await fetch(notification.subscription_url, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${await getGithubToken()}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    console.error(`Failed to unsubscribe from notification with thread URL ${notification.url} from repo ${notification.repository.full_name}: ${response.status} ${response.statusText}`);
  }
}


async function main() {
  const since = process.argv[2];
  if (!since) {
    console.error(`Usage: ${basename(process.argv[0])} ${basename(process.argv[1])} <since>`);
    process.exit(1);
  }
  
  try {
    new Date(since);
  } catch (error) {
    console.error(`${since} is not a valid ISO 8601 date. Must be formatted as YYYY-MM-DDTHH:MM:SSZ.`);
    console.error(`Usage: ${basename(process.argv[0])} ${basename(process.argv[1])} <since>`);
    process.exit(1);
  }

  const notifications = await getNotifications(since);
  for (const notification of notifications) {
    if (await shouldIncludeNotificationForRemoval(notification)) {
      console.log(`Marking notification with thread URL ${notification.url} read from repo ${notification.repository.full_name}`);
      await markNotificationRead(notification);
      console.log(`Marking notification with thread URL ${notification.url} done from repo ${notification.repository.full_name}`);
      await markNotificationDone(notification);
      console.log(`Unsubscribing from notification with thread URL ${notification.url} from repo ${notification.repository.full_name}`);
      await unsubscribe(notification);
    }
  }
  console.log("Done");
}

main().catch(console.error);