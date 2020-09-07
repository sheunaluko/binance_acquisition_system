const Binance = require('node-binance-api');
const binance = new Binance().options({});
const fs      = require('fs') 

const fname = "trade_blob.ndjson" 

let save = (trade) => fs.appendFileSync(fname,JSON.stringify(trade) + "\n") 

binance.websockets.trades(['ETHUSDT', 'BTCUSDT'], (trade) =>  save(trade) ) 
	
