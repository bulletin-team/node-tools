var WebSocketServer = require('ws').Server, mysql = require('mysql');

var sql_auth = {'host': 'localhost',
                'user': 'bullechat',
                'password': 'mxqsCvfoIbNjLWpP',
                'database': 'bulletin'};

function query (query, fields, callback) {
  var con = mysql.createConnection(sql_auth);
  con.connect(function (e) {
    if (e) callback(e);
    else con.query(query, fields, function (err, result) {
      callback(err, result);
      con.end(function(){});
    });
  });
}

var fs = require('fs');
var httpServ = require('https');
var WebSocketServer = require('ws').Server;
function processRequest (req, res) {
  res.writeHead(200);
  res.end("WebSockets are lit, fam!\n");
}
var app = httpServ.createServer({
  cert: fs.readFileSync('/etc/letsencrypt/live/sek.cflems.net/fullchain.pem'),
  key: fs.readFileSync('/etc/letsencrypt/live/sek.cflems.net/privkey.pem')
}, processRequest).listen(2442);

var map = {};
var once = require('once');
var wss = new WebSocketServer({server: app});
wss.on('connection', function (wsConnect) {
  wsConnect.once('message', once(function (data) {
    var authdata = JSON.parse(data);
    if (authdata.id && authdata.session) {
      query('SELECT id, email, name FROM users WHERE id = ? AND session = ?', [authdata.id, authdata.session], function (err, result) {
        if (liability(wsConnect, err)) return;
        else {
          if (result.length < 1) {console.log('auth failure');wsConnect.close();}
          else {
            var uname = result[0].email;
            var mynick = result[0].name;
            findMsgs(result[0].id, wsConnect);

            map[uname] = wsConnect;
            wsConnect.on('close', function () {
              delete map[uname];
            });
            wsConnect.on('message', function (msg) {
              msgAttempt(wsConnect, uname, msg, mynick);
            });
          }
        }
      });
    } else {
      console.log('incomplete info');
      wsConnect.close();
    }
  }));
});

function liability (sockfd, err) {
  if (err) {
    sockfd.close();
    console.log(sockfd+' caused SQL error '+err);
  }
  return err;
}

function findMsgs (id, sockfd) {
  query('SELECT chat.src, chat.msg, users.name FROM chat INNER JOIN users ON users.email = chat.src WHERE chat.dst = ?', [id], function (err, result) {
    if (liability(sockfd, err)) return;
    if (result.length < 1) return;
    query('DELETE FROM chat WHERE dst = ?', [id], function (e) {
      liability(sockfd, e);
    });
    for (var i = 0; i < result.length; i++) {
      sockfd.send(JSON.stringify({uname: result[i].src, msg: result[i].msg, nick: result[i].name}));
    }
  });
}

function msgAttempt (fromfd, fromusr, data, fromnick) {
  var reqdat = JSON.parse(data);
  if (!reqdat.user || !reqdat.msg) {fromfd.close(); return;}
  if (map[reqdat.user]) {
    map[reqdat.user].send(JSON.stringify({uname: fromusr, msg: reqdat.msg, nick: fromnick}));
  } else {
    query('SELECT id FROM users WHERE email = ?', [reqdat.user], function (e, r) {
      if (liability(fromfd, e)) return;
      if (r.length < 1) {fromfd.close(); return;}
      query('INSERT INTO chat (dst, src, msg) VALUES (?, ?, ?)', [r[0].id, fromusr, reqdat.msg], function (err) {
        liability(fromfd, err);
      });
    });
  }
}
