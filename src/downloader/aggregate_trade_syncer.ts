import {tsd as ts} from "../tsd.ts" 
let fp = ts.util.common.fp 

//get some of the types 
import {Status, 
	Result, 
	AsyncResult, 
	AsyncResults} from "../tsd.ts" 

let {Ok, Err} = Status 
// ---------------------- 


type LastTrades  = {[k:string] : number } 

export async function get_sync_data(last_trades : LastTrades, log : any) { 
    
    //last_trades["SPOT_BTCUSDT"] = -1 

    
    let syms = fp.keys(last_trades) 

    var to_return = fp.clone(last_trades) 
    
    var synced_trades : any = {} 
    
    for (var sym of syms) { 
	
	if (last_trades[sym] > -1) { 
	    

	    let url = url_from_sym_id(sym,last_trades[sym]) 
	    
	    log(`Syncing: ${sym} with url ${url}`) 
	    
	    let result : any = await ts.util.base_http_json(url)

	    if (result.status == Ok ) {
		to_return[sym] = result.value 
	    } else  { 
		//got some error 
		throw(result.error.description)
	    } 
	    
	    
	} else { 
	    
	    //nothing to sync for this one  
	} 
	
    } 
    
    return to_return 
    
} 


function url_from_sym_id(sym : string,id: number) {
    let [future_or_spot, symbol] = sym.split("_")  
    symbol = symbol.toLowerCase() 
    
    var url : string ; 
    if (future_or_spot == "FUTURES" ) { 
	//futures url 
	url = `https://fapi.binance.com/fapi/v1/aggTrades?symbol=${symbol}&fromId=${id+1}&limit=1000`
    } else { 
	//spot 
	url = `https://api.binance.com/api/v3/aggTrades?symbol=${symbol.toUpperCase()}&fromId=${id+1}&limit=1000`
    } 
    return url 
} 
