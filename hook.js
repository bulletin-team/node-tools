const fs = require('fs');
const path = require('path');
const githubhook = require('githubhook');
const exec = require('child_process').exec;

let github = githubhook({
  host: '0.0.0.0',
  port: 3908,
  path: '/push',
  secret: fs.readFileSync(path.join(__dirname, 'config', 'hook_secret'), 'ascii'),
});
github.on('push', function (repo, ref, data) {
  ref = ref.split('/');
  ref = ref[ref.length-1];
  exec('su bulletin -c \'cd /home/bulletin/web && git pull -q origin '+ref+'\'', function(){});
});
github.listen();
