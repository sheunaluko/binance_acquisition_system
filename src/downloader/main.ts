/* main deno script for downloading 
 
   Architecture has been updated to be crash resistant. 
   when the process initializes it reads from the info/trade_ids directory 
   to see what the last trade id saved for each pair was 
   
   Then it will connect to websocket and start BUFFERING new trades 
   
   Then it will launch a subcommand 
   
   
   
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

let run_time_ms = (20/60)*60*1000


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
    BUFFER : [object,string][] , 
    READY : {[k:string] : boolean } 
} 

var state : State = { 
    BUFFERING : true, // flag to determine if we are buffering messages prior to writing 
    BUFFER : [] , 
    READY : {
	SPOT : false , 
	FUTURES : false 
    }
} 

await asnc.wait_until( ()=> (state.READY.SPOT && state.READY.FUTURES) , 60*1000 )
log("Buffering spot and futures data, will sync before writing") 

let data_to_sync = await ats.get_sync_data(last_trades,log) 

log("Retrieved the following data to sync!") 

/* TODO 
log(data_to_sync)  map this so I just see the num trades 

1) LOOP THROUGH THE KEYS OF DATA TO SYNC and if there is an array there 
- append the same timestamp to all of the data 
- write all the data to file  
   - WONT WORK: (because BUFFERING STILL TRUE) simply calling the save handler(data,future_or_spot) for each data point 
- keep track of the LAST ID written for each pair 

2) Modify save_handler to keep track in memory of the last id that was saved for each 
   pait 
   
   have to figure out how to flush the buffer safely and ensure the ordering of the trades 
   hmmm... and the timing of setting the BUFFERING to false... etc... 
   
   One way would be to have a buffer inside of save handler itself and then sort it before 
   inserting into text file 
   
   [ ] OK this is a good way ... 
   once the sync is complete ... a switch notifies the save handler 
   
   INSIDE the save handler, IF the buffering has been turned off but the buffer 
   still has elements inside, then the save handler will loop through WHOLE BUFFER 
   and save all those datapoints FIRST before proceeding 
   - seems that I should have a wrapper function [ ] save_bufferer which does this, loops 
   through and then calls the save_handler to actually write to disk


*/ 


// -------------------------------------------------- 

async function main() {

    let symbol_data = process_symbol_file() 
    
    log("Retrieved the following symbol data") 
    log(symbol_data) 
    
    let spot_ws_url = params.spot_ws_url + syms_to_agg_sym_array(symbol_data.SPOT) +  syms_to_partial_depth_sym_array(symbol_data.SPOT,"1000")
    
    let futures_ws_url = params.futures_ws_url + syms_to_agg_sym_array(symbol_data.FUTURES) + syms_to_partial_depth_sym_array(symbol_data.FUTURES,"500")  + syms_mark_sym_array(symbol_data.FUTURES)

    log("Will use spot url:: " + spot_ws_url) 
    //log("Will use futures url:: " + futures_ws_url) 
    
    //assign the spot_ws 
    spot_ws = ts.util.WebSocketMaker({ 
	json: true, 
	url : spot_ws_url, 
	handler: function(d : any) {
	    //immediately append the acquisition time stamp 
	    d.data.time = (new Date).getTime() 
	    //send it to be saved 
	    try {
		save_handler(d,"SPOT")
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
	
    

    //assign the futures url 
    futures_ws = ts.util.WebSocketMaker({ 
	url : futures_ws_url, 
	json : true, 
	handler: function(d : any) {
	    //immediately append the acquisition time stamp 
	    d.data.time = (new Date).getTime() 
	    //send it to be saved 
	    try {
		save_handler(d,"FUTURES")
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
	    
    //done 
    
} 

function flush_buffer_to_disk() { 
    //for every trade in the buffer, write it to its appropriate file 
    //IF the id has not already been written to that file 
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


function save_handler(data : any, future_or_spot : string){ 
    
    //if buffering then we just add to the data buffer 
    if (state.BUFFERING) {
	state.BUFFER.push([data,future_or_spot])
	state.READY[future_or_spot] = true  
	return
    } 
    
    //if not we will actually save the data 
    
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
	console.log("Saving to: " + trade_id_path) 
	console.log(data.data.a)
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
