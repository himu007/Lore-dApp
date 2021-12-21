
'use strict';
var express  = require('express');
var app      = express();
var http     = require('http').Server(app);
var io       = require('socket.io')(http);
var nanoId  = require('nanoid');
var requestify = require('requestify');

const serverUrl_LoreOnline = "http://loreofthetokels.online:8080/"

const kmdmessages = require('./net/kmdmessages');
const cctokens = require('./cc/cctokensv2');
const general = require('./cc/general');
const ccutils = require('./cc/ccutils');

// create peer group
const NspvPeerGroup = require('./net/nspvPeerGroup');
const peerutils = require('./net/utils');
require('./net/nspvPeer'); // init peer.js

const networks = require('./src/networks');
const mynetwork = networks.TKLTEST;

// init cryptoconditions and wasm
const ccbasic = require('./cc/ccbasic');
const { addAbortSignal } = require('stream');
const { nextTick } = require('process');
// let ccimp;
var ccimp = require('./cc/ccimp');

var params = {
  network: mynetwork, 
  protocolVersion: 170009,
  messages: kmdmessages.kmdMessages
}

var opts = {
  numPeers: 8,
  wsOpts: { rejectUnauthorized: false }  // allow self-signed certificates
}

var peers;

// allow Unity WASM builds to be served static
app.use("/public/Build", express.static(__dirname + "/public/Build"));
app.use(express.static(__dirname+'/public'));

// required delay between nspv calls
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// hexify arbitrary data
function hexify(arrayBuffer)
{
  return Array.from(new Uint8Array(arrayBuffer))
  .map(n => n.toString(16).padStart(2, "0"))
  .join("");
}

function hex_to_human(str1)
 {
	var hex  = str1.toString();
	var str = '';
	for (var n = 0; n < hex.length; n += 2) {
		str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
	}
	return str;
 }

var mykeypair = null;

// nSPV functions 

app.get('/nspv/logout', (req, res) => {
  mykeypair = null;
  res.json({
    result: "success"
  })
});

app.get('/nspv/login/:seed', (req, res) => {
  var myseed = decodeURI(req.params.seed);
  mykeypair = general.getKeyPairFromWif(myseed, mynetwork);
  res.json({
    result: "success"
  })
});

app.get('/nspv/isloggedin', (req, res) => {
  if(mykeypair != null) {
    res.json({
      result: "success"
    })
  } else {
    res.json({
      result: "error"
    })
  }
  
});

app.get('/nspv/getpubkey', (req, res) => {

  if(mykeypair!=null) {
    res.json({
      result: mykeypair.getPublicKeyBuffer().toString('hex')
    });
  } else {
    res.json({
      result: "error"
    })
  }
  
});

app.get('/nspv/getaddress', (req, res) => {

  if(mykeypair!=null) {
    res.json({
      "address" : mykeypair.getAddress(),
      }
    );
  } else {
    res.json({
      result: "error"
    })
  }

});

app.get('/nspv/getnewaddress', (req, res) => {
    var seedphrase = general.getSeedPhrase(256);
    var kp = general.getKeyPairFromWif(seedphrase, mynetwork);
    mykeypair = kp;
    res.json({
                "seed" : seedphrase,
                "wif" : kp.toWIF(),
                "address" : kp.getAddress(),
                "pubkey" : kp.getPublicKeyBuffer().toString('hex')
            }
    );
});

app.get('/nspv/getbalance', (req, res) => {
  
  peers = new NspvPeerGroup(params, opts);
 
  peers.nspvConnect(async () => { 
    try {
      ccbasic.cryptoconditions = await ccimp;

          let utxos = await ccutils.getNormalUtxos(peers, mykeypair.getAddress(), 0, 1);
          let myJsonifiedUtxos = [];
          
          res.json({
            result: utxos.total
          }
            
          );
          peers.close();
    } catch (error) {
      
      peers.close();
      res.json( {
        result: "error"
      }
      );
      console.log(error);
    }

  });

}); 

app.get('/nspv/gettokens/:pubkey', (req, res) => {
    var pkey = req.params.pubkey;

    peers = new NspvPeerGroup(params, opts);
   
    peers.nspvConnect(async () => { 
      try {
        ccbasic.cryptoconditions = await ccimp;

            let nft = await cctokens.getTokensForPubkey(mynetwork, peers, Buffer.from(pkey, 'hex'), 0, 10);

            let myJsonifiedTokels = [];

            nft.forEach(element => {

              var tokel = {};

              if(element!=undefined) {
                tokel["name"] = element["tokendata"].name;
                tokel["description"] = element["tokendata"].description;
                if(element["tokendata"].tokeldata) {
                  tokel["url"] = element["tokendata"].tokeldata.url;
                  tokel["data"] = hex_to_human(hexify(element["tokendata"].tokeldata.arbitrary));
                }
               
                myJsonifiedTokels.push(tokel);
              }
              // console.log(JSON.stringify(myJsonifiedTokels));
            
            });

            //console.log(nft);
            // console.log(nft[1]);
            // console.log("==========================================");
            // console.log(hexify(nft[1].txid));
            // console.log(nft[1]["tokendata"].name);
            // console.log(nft[1]["tokendata"].description);
            // console.log(nft[1]["tokendata"].tokeldata.url);
            // console.log(nft[1]["tokendata"].tokeldata.id);
            // console.log(hexify(nft[1]["tokendata"].tokeldata.arbitrary));
            // console.log(hex_to_human(hexify(nft[1]["tokendata"].tokeldata.arbitrary)));
            // console.log("=----------------------------------------=");
            // console.log(nft[1]["tokendata"].blobs);

            res.json({
              result: myJsonifiedTokels
            }
              
            );
            peers.close();
      } catch (error) {
        
        peers.close();
        res.json( {
          result: "error"
        }
        );
        console.log(error);
      }

    });

}); 

app.get('/nspv/transfertoken/:tokenid/:destination', (req, res) => {

    var transferTokenId = req.params.tokenid;
    var transferDestinationPubKey = req.params.destination;

    peers = new NspvPeerGroup(params, opts);
    peers.nspvConnect(async () => {
        try {
            ccbasic.cryptoconditions = await ccimp;
            let tx = await cctokens.tokensv2Transfer(peers, mynetwork, mykeypair.toWIF(), transferTokenId, transferDestinationPubKey, 1);
            res.json({
                        "result" : tx,
                        "hex": tx.toHex()
                     }
            );
            peers.close();
        } catch (error) {

        }
    });
    
});

app.get('/nspv/spend/:amount', (req, res) => {

  var txAmount = req.params.amount;
  
  peers = new NspvPeerGroup(params, opts);
 
  peers.nspvConnect(async () => { 
    try {
      ccbasic.cryptoconditions = await ccimp;

          let utxos = await ccutils.getNormalUtxos(peers, mykeypair.getAddress(), 0, 1);
          let myJsonifiedUtxos = [];
          
          res.json({
            result: utxos.total
          }
            
          );
          peers.close();
    } catch (error) {
      
      peers.close();
      res.json( {
        result: "error"
      }
      );
      console.log(error);
    }

  });

}); 

// Lore MMO functions

// ----------------------------------------------------------- to be added

// Lore Server functions

app.get('/lore/createknight/:astrochart/', (req, res) => {
  var astro = req.params.astrochart;
  let createknight = serverUrl_LoreOnline + "createknight/" + astro;
  requestify.get(createknight).then(function(response) {
    response.body;
  });
});

app.get('/lore/stats/:tokenid', (req, res) => {
  var tokenstatsid = req.params.tokenid;
  let loretokenstats = serverUrl_LoreOnline + "statistics/" + tokenstatsid;
  requestify.get(loretokenstats).then(function(response) {
    response.body;
  });
});

app.get('/lore/battle/:battleid', (req, res) => {
  var battleid = req.params.battleid;
  let lorebattle = serverUrl_LoreOnline + "battles/" + battleid;
  requestify.get(lorebattle).then(function(response) {
    response.body;
  });
});

app.get('/lore/earn/:puzzleid', (req, res) => {
  var puzzleid = req.params.puzzleid;
  let lorepuzzle = serverUrl_LoreOnline + "puzzles/" + puzzleid;
  requestify.get(lorepuzzle).then(function(response) {
    response.body;
  });
});

app.get('/lore/reward/:rewardid', (req, res) => {
  var rewardid = req.params.rewardid;
  let lorereward = serverUrl_LoreOnline + "rewards/" + rewardid;
  requestify.get(lorereward).then(function(response) {
    response.body;
  });
});


app.get('/', (req, res) => {
    res.send('OK');
});

app.get('/version', (req, res) => {
    res.json({
                "version": "0.0.1", 
                "game" : "Lore of the Tokels",
                "url" : "http://www.loreofthetokels.online"
            }
            );

});

app.get('/stop', (req, res) => {
  server.close(() => {
    console.log('Lore of the Tokels exited.')
  });
});

const server = http.listen(process.env.PORT ||8080, function(){
	console.log('listening on *:8080');

});

process.on('SIGTERM', () => {
    server.close(() => {
      console.log('Lore of the Tokels exited.')
    })
})

