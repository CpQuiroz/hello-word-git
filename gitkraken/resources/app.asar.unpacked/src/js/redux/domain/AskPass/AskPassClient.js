const net = require('net');

const {
  GITKRAKEN_ASKPASS_SESSION_ID,
  GITKRAKEN_SOCKET_SERVICE_PORT
} = process.env;

const [, , ppid, ...args] = process.argv;

const request = {
  s: GITKRAKEN_ASKPASS_SESSION_ID,
  p: parseInt(ppid, 10),
  f: null, // request field
  u: null // url for request
};

const promptArg = args.join(' ');
const usernameMatch = /^Username for (.+)/g.exec(promptArg);
const passwordMatch = /^Password for (.+)/g.exec(promptArg);
const passphraseMatch = /^Enter passphrase for key (.+)/g.exec(promptArg);

let match;
if (usernameMatch) {
  request.f = 'u';
  match = usernameMatch;
} else if (passwordMatch) {
  request.f = 'pw';
  match = passwordMatch;
} else if (passphraseMatch) {
  request.f = 'p';
  match = passphraseMatch;
}

if (!request.f) {
  process.exit(1);
}

const [, url] = match;
request.u = url.endsWith(':') ? url.substr(0, url.length - 1) : url;

const performHandshake = clientSocket => new Promise((resolve, reject) => {
  clientSocket.on('error', reject);
  clientSocket.on('close', reject);
  clientSocket.on('end', reject);

  clientSocket.once('data', (data) => {
    clientSocket.removeListener('error', reject);
    clientSocket.removeListener('close', reject);
    clientSocket.removeListener('end', reject);

    if (data.toString() !== 'ready') {
      reject();
    } else {
      resolve();
    }
  });

  clientSocket.write('ask_pass');
});

const client = net.createConnection(
  {
    port: GITKRAKEN_SOCKET_SERVICE_PORT,
    host: 'localhost'
  },
  async () => {
    try {
      await performHandshake(client);
    } catch (error) {
      process.exit(1);
    }

    client.on('error', () => process.exit(1));
    client.on('end', () => process.exit(1));

    client.on('data', (data) => {
      try {
        const {
          r: result,
          c: exitCode
        } = JSON.parse(data.toString());
        if (result) {
          process.stdout.write(result);
          process.exit(0);
        } else if (exitCode) {
          process.exit(exitCode);
        } else {
          process.exit(1);
        }
      } catch (error) {
        process.exit(1);
      }
    });
    client.write(`${JSON.stringify(request)}\0`);
  }
);
