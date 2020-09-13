/* main deno script for downloading 
   
   Architecture has been updated to be crash resistant. 
   when the process initializes it reads from the info/trade_ids directory 
   to see what the last trade id saved for each pair was 
   Then it will connect to websocket and start BUFFERING new trades 
   As the trades are buffering it requests the trades since the identified last trades 
   (that were missed while offline) 
   Then it writes these missed trades to disk keeping track of last id saved for each pair
   Then it dumps the buffer to disk but only those IDs for each pair that 
   have not already been dumped 
   
   Update [Sun Sep 13 15:42:07 PDT 2020] 
   - I implemented the above and was relaunching the process each hour however I encountered 
   the following bug: 
   - There would be consistenetly missing data each hour because the maximum number of aggregate 
   trade ids that can be downloaded at one time for each pair is 1000 i believe, so I  
   noticed that this was getting maxed out and thus data was missing. 
   
   To temporarily fix this I changed the restart interval to 24 hours but still have very slight 
   missing data. 
    - Another potential fix: check if 1000 elements were retrieved and if so recursively try to get 
    the previous data 
    
    
   
*/

import * as params from "../parameters.ts" 
import {tsd as ts} from "../tsd.ts" 
import * as util from "./util.ts" 
import * as ats from "./aggregate_trade_syncer.ts" 

let date = ts.util.common.Date 
let fp = ts.util.common.fp 
let asnc = ts.util.common.asnc

/* first check logging */  
let log = get_logger() 

/*  initialize directories, other stuff  */
var {last_trades} = run_initialization() 

/* start stuff  */ 
log("Initializing") 

let run_time_ms = 24*60*60*1000 //re-connect interval in ms
//interestingly - had a bug where there were more than 1000 trades happening during the reconnection --
//for now, its not perfect, but i'm just gonna change reconnect interval to 1dx


//get global refs so we can disconnect them 
var spot_ws : ts.base.WebSocket; 
var futures_ws : ts.base.WebSocket; 

//launch the program 
log(`Program will terminate in ${run_time_ms/1000/60/60} hours`) 
main()

//and set our timeout to terminate the process 
setTimeout(function(){
    log("Program will exit now!") 
    //first try to close the websockets 
    spot_ws.close() 
    futures_ws.close() 
    //then exit 
    //Deno.exit(0) 
}, run_time_ms) 



interface State { 
    BUFFERING : boolean, 
    BUFFER : [any,string][] , 
    BUFFER_FLUSHED : boolean , 
    READY : {[k:string] : boolean } 
} 

var state : State = { 
    BUFFERING : true, // flag to determine if we are buffering messages prior to writing 
    BUFFER : [] , 
    BUFFER_FLUSHED : false, 
    READY : {
	SPOT : false , 
	FUTURES : false 
    }
} 


await asnc.wait_until( ()=> (state.READY.SPOT && state.READY.FUTURES) , 60*1000 )
log("Buffering spot and futures data, will sync before writing") 
let data_to_sync = await ats.get_sync_data(last_trades,log) 

log("Retrieved data to sync!") 



interface SyncTracker { 
    [k: string] : number 
} 

var sync_tracker : SyncTracker = {}  

log("<<<<====STARTING SYNC ===== >>>")	

//summarize what will be synced 
log("PRESYNC SUMMARY")
for (var sym of fp.keys(data_to_sync) ) { 
    
    let to_sync = data_to_sync[sym] 
    
    if (to_sync == -1 ) { 
	
	//nothing to sync 
	log(`Sym[${sym}]::None`)
	
    } else { 
	
	//to_sync is the array of data to write 
	if (fp.is_empty(to_sync)) { 
	    log(`Sym[${sym}]::0`)	    
	} else { 
	    log(`Sym[${sym}]::${fp.len(to_sync)}, ${to_sync[0].a} -> ${to_sync[to_sync.length-1].a}`)
	} 
    } 
} 
log("PRESYNC SUMMARY DONE -> now syncing")


for (var sym of fp.keys(data_to_sync) ) { 
    
    let to_sync = data_to_sync[sym] 
    
    if (to_sync == -1 ) { 
	
	//nothing to sync 
	log(`Sym[${sym}]::0`)
	
    } else { 
	
	//to_sync is the array of data to write 
	log(`Sym[${sym}]::${fp.len(to_sync)}`)
	let [future_or_spot, symbol ] = sym.split("_") 
	
	for (var dp of to_sync) { 
	    //keep track of the last added id 
	    sync_tracker[future_or_spot + symbol] = dp.a 
	    
	    //reconstruct as if it came as websocket message 
	    let d : any = { stream : symbol + "@aggTrade" , 
			    data   : dp  } 
	    //add a time 
	    d.data.time = (new Date).getTime() 	    
	    
	    //and then call the save handler 
	    save_handler(d,future_or_spot) 
	} 
    }
} 

log("<<<<====FINISHEDSYNC ===== >>>")	

//so now all the data has been synced... we can disable the buffer 
log("Terminating buffering state")
state.BUFFERING = false  

// -------------------------------------------------- 

function get_urls()  {

    let symbol_data = process_symbol_file() 
    
    log("Retrieved the following symbol data") 
    log(symbol_data) 

    let spot_url = params.spot_ws_url +  fp.join([syms_to_agg_sym_array(symbol_data.SPOT),
						  syms_to_partial_depth_sym_array(symbol_data.SPOT,"1000")],"/") 
    
    let spot_trade = params.spot_ws_url +  syms_to_agg_sym_array(symbol_data.SPOT)
    
    let futures_url = params.futures_ws_url + fp.join([syms_to_agg_sym_array(symbol_data.FUTURES),
						       syms_to_partial_depth_sym_array(symbol_data.FUTURES,"500"),
						       syms_mark_sym_array(symbol_data.FUTURES)],"/") 

    let futures_trade = params.futures_ws_url + syms_to_agg_sym_array(symbol_data.FUTURES) 

    return { 
	spot_url , spot_trade, futures_url, futures_trade  
    } 
    
} 

async function main() {

   
    let {spot_url : spot_ws_url, futures_url : futures_ws_url} = get_urls() 
    
    log("Will use spot url:: " + spot_ws_url) 
    log("Will use futures url:: " + futures_ws_url) 
    
    //assign the spot_ws 
    if (spot_ws_url != "") { 
	spot_ws = ts.util.WebSocketMaker({ 
	    json: true, 
	    url : spot_ws_url, 
	    handler: function(d : any) {
		//immediately append the acquisition time stamp 
		d.data.time = (new Date).getTime() 
		//send it to be saved 
		try {
		    buffer_or_save(d,"SPOT")
		    //log("saving data: " + d.stream) 
		    
		} catch (e) {
		    log("Error saving data point: ") 
		    log(d) 
		    log(e)
		} 
	    }, 
	    open : function() { 
		log("Opened connection to spot url") 
	    }, 
	    close : function() { 
		log("Conection to spot url closed") 
	    }, 
	    error : function(e : any) { 
		log("Conection to spot url errored") 
		log(e) 
	    }
	})
    }
    
    

    //assign the futures url 
    if (futures_ws_url != "" ) { 
	futures_ws = ts.util.WebSocketMaker({ 
	    url : futures_ws_url, 
	    json : true, 
	    handler: function(d : any) {
		//immediately append the acquisition time stamp 
		d.data.time = (new Date).getTime() 
		//send it to be saved 
		try {
		    buffer_or_save(d,"FUTURES")
		    //log("saving data: " + d.stream) 
		} catch (e) {
		    log("Error saving data point: ") 
		    log(d) 
		    log(e)
		} 
	    }, 
	    open : function() { 
		log("Opened connection to futures url") 
	    }, 
	    close : function() { 
		log("Conection to futures url closed") 
	    }, 
	    error : function(e : any) { 
		log("Conection to futures url errored") 
		log(e) 
	    }
	})
    }
    
    //done 
    
} 


function syms_to_agg_sym_array(syms : string[]) {
    return fp.join(fp.map(syms, (s:string)=> s.toLowerCase() +"@aggTrade"),"/")
} 

function syms_to_partial_depth_sym_array(syms : string[],speed : string) {
    return fp.join(fp.map(syms, (s:string)=> s.toLowerCase() +`@depth10@${speed}ms`),"/")
} 

function syms_mark_sym_array(syms : string[]) {
    return fp.join(fp.map(syms, (s:string)=> s.toLowerCase() +"@markPrice"),"/")    
} 



function buffer_or_save(data : any, future_or_spot : string){ 

    //if buffering then we just add to the data buffer 
    if (state.BUFFERING) {
	state.BUFFER.push([data,future_or_spot])
	state.READY[future_or_spot] = true  
	return
    } 
    /*
      if not we will actually save the data 
      HOWEVER -- we first have to check if there is stuff in the buffer 
      if there is stuff in the buffer it means that 
      1) the sync has completed 
      2) the buffer_or_save has been called because there is a NEW websocket message coming 
      in which is NOT in the buffer 
      SO.. FIRST we need to flush the buffer and THEN handle the current data 
    */ 
    /*
      THis if statement will flush the buffer and ensure that no duplicates are added 
      This is because while we are buffering a separate program synced the gap and wrote them to disk already, 
      But there may be some overlap 
    */
    if (!state.BUFFER_FLUSHED) { 
	//this is the first time that the handler is being called after sync has completed 
	log("")
	log("")
	log("<<<<====FLUSHING BUFFER===== >>>")	
	log("Buffer will be flushed!") 
	
	log(`There are ${fp.len(state.BUFFER)} elements in the buffer`) 
	
	
	log("====BUFFER=====")
	for (var b of state.BUFFER) { 
	    log(b) 
	} 
	log("=========")
	
	log("Will print the sync state =>") 
	log(sync_tracker) 
	
	for ( var tmp of state.BUFFER) { 
	    //loop through all data in buffer 
	    let [dta,fos] = tmp 
	    
	    
	    let tmp_id = (fos+dta.stream.split("@")[0]).toUpperCase()
	    let last_id_saved = sync_tracker[tmp_id] //sync tracker defined above 
	    log(`Using ${tmp_id} to check for last id= ${last_id_saved}`) 
	    log(sync_tracker) 
	    
	    
	    //if the dta.stream does not contain @aggTrade then we save it and move on 
	    if (! (dta.stream.indexOf("aggTrade") > -1 ) ) { 
		log(`>>AUTO saving id= ${fos}_${dta.stream}_${dta.data.a}`) 		    		
		save_handler(dta,fos) ; 
		continue; 
	    } 
	    
	    if (!last_id_saved) { 
		//log("No buffering")
		//means that there was no buffering that occured for this.. so we just save 
		log(`>>NO_SYNC saving id= ${fos}_${dta.stream}_${dta.data.a}`) 		    
		save_handler(dta,fos) 
		//log(last_id_saved) 
	    } else { 
		//log("lastID= " + last_id_saved) 
		//log(fos+dta.stream) 
		//there was an id that was saved 
		if (last_id_saved < dta.data.a ) {  /// AAAAAHHHHHH!!!! had a bug here that was FREAKIN HARD TO FIND (had to sleep on it) i had < data.data.a !! omfg
		    //and it is less than the id we are flushing from the buffer so we keep it 
		    log(`>>YES_SYNC Saving id= ${fos}_${dta.stream}_${dta.data.a}`) 		    		    
		    save_handler(dta,fos) 
		} else { 
		    //and it is greater than the id we are trying to flush 
		    //ignore it! 
		    log(`>>IGNORE duplicate for id= ${fos}_${dta.stream}_${dta.data.a}`) 		    
		} 
	    }
	    
	}
	
	log("Buffer was flushed!")
	state.BUFFER_FLUSHED = true 
	log("<<<<==== DONE FLUSHING BUFFER===== >>>")		
	log("")
	log("")
    } 
    
    //now at this point we should continue with saving the original data point that trigger this call
    save_handler(data,future_or_spot) 
    
    
}


/*
  eth fut 9465 
  eth spot 9395
  
*/


function save_handler(data : any, future_or_spot : string){ 

    /*
    log("--------")    
    log("SAVE HANDLER CALLED:")
    log(future_or_spot)
    log(data.stream)
    log(data.data.a) 
    log("--------")
    */ 

    let toks = data.stream.split("@") 
    
    var  sym  = toks[0].toUpperCase() 
    var day = date.to_iso_day_filename(new Date(data.data.time)) //get the day to save to 
    
    var dirname = ts.io.path.join(params.datadir,day,sym,future_or_spot) 
    Deno.mkdirSync(dirname , { recursive: true })    
    

    
    if (toks.length == 2) { //aggTrade || MARK 
	
	if (toks[1] == "aggTrade") { 
	    var fname = ts.io.path.join(dirname, sym + "_TRADE.json")
	} else if (toks[1] == "markPrice") { 
	    var fname = ts.io.path.join(dirname, sym + "_MARK.json")
	} else { 
	    log("Error in save handler for data")
	    log(data)
	    log("token length was 2 but didnt match")
	    return 
	} 
	
	
    } else if (toks.length == 3) { //depth 

	var fname = ts.io.path.join(dirname, sym + "_DEPTH.json")
	
	
    } else {
	log("Error in save handler for data: ")
	log(data) 
	log("Token length not 2 or 3") 
	return 
    } 
    
    //now we append the data to the file! 
    ts.io.appendTextFileSync(fname, JSON.stringify(data.data)+"\n")
    
    if (data.stream.indexOf("aggTrade") > -1 ) { 
	//and update the trade_id
	let trade_id_path = ts.io.path.join(params.infodir,"trade_ids",`${future_or_spot}_${data.stream.replace("@aggTrade","").toUpperCase()}`)
	//console.log("Saving to: " + trade_id_path) 
	//console.log(data.data.a)
	Deno.writeTextFileSync(trade_id_path, String(data.data.a))
    }
    
} 


function process_symbol_file() {
    var data : {[k:string] : string[]}  = {  "SPOT" : [] , "FUTURES" : [] } 
    let syms = ts.io.readJSONFileSync(params.symbol_file) 
    for (var sym of syms) {
	let [hdr,_sym]  = (sym.split("_") as [string,string])
	data[hdr].push(_sym)
    } 
    return data 
} 



function check_symbol_directories(syms: string[]) { 
    log("Skipping directory check")
    /*  legacy 
	let today_fname = date.iso_day_filename() 
	let tmrw_fname  = date.to_iso_day_filename(date.shift_date(new Date(),1,"day"))
	
	let data_dir_today = ts.io.path.join(params.datadir,today_fname)
	let data_dir_tmrw = ts.io.path.join(params.datadir,tmrw_fname) 
	log("Ensuring data directory: " + data_dir_today) 
	Deno.mkdirSync(data_dir_today , { recursive: true })	
	log("Ensuring data directory: " + data_dir_tmrw) 	
	Deno.mkdirSync(data_dir_tmrw , { recursive: true })
	
	for (var sym of syms) {
	//make sure the info directory exists 
	let sym_info_dir = ts.io.path.join(params.infodir, sym)
	//not doing anything really though 
	
	} 
    */
} 

function run_initialization() {
    Deno.mkdirSync(params.datadir , { recursive: true });
    Deno.mkdirSync(params.infodir , { recursive: true });    
    Deno.mkdirSync(ts.io.path.join(params.infodir,"trade_ids") , { recursive: true });     
    
    log("I N I T I A L I Z I N G - - - - - - - > ") 
    
    if (!ts.io.fileExistsSync(params.symbol_file) ) {
	log("Could not find the symbol file at: " + params.symbol_file)
	log("Aborting") 
	Deno.exit(1)  
    } 

    log(`Data dir and info dir: ${params.datadir} , ${params.infodir}`)     
    
    
    log("The following symbols will be processed")
    let syms = ts.io.readJSONFileSync(params.symbol_file) ;  log(syms) 
    
    //for each symbol we read from info dir  
    var last_trades : any = {} 
    for (var sym of syms ) {
	let trade_id_path = ts.io.path.join(params.infodir,"trade_ids",sym) 
	var last_trade = -1  
	try { 
	    last_trade = Number(Deno.readTextFileSync(trade_id_path))
	} catch (e) {
	    
	} 
	last_trades[sym] = last_trade 
    } 
    
    log("Will use the following last trade ids :") 
    log(last_trades)
    
    check_symbol_directories(syms) //make sure all the directories we need are created 
    
    return {last_trades} 

} 

function get_logger() {
    if (params.log_to_file && params.logfile) { 
	return ts.io.get_logger("dl",params.logfile) 
    }  else { 
	return ts.io.get_logger("dl") 
    } 
} 
