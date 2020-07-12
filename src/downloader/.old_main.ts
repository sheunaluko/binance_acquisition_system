// main deno script for downloading 

import * as params from "../parameters.ts" 
import {tsd as ts} from "../tsd.ts" 
import * as util from "./util.ts" 
let Date = ts.util.common.Date 

/* first check logging */  
let log = get_logger() 

/*  initialize directories, other stuff  */
run_initialization() 

/* start the main loop */ 
log("Initializing main download loop") 
while (true) {
    //acquisition loop 
    await main_acquisition_loop() 
    //sleep for certain amount of time
    await util.asnc.wait(params.inter_loop_interval) 
} 


// -------------------------------------------------- 

async function main_acquisition_loop() {
    // - 
    log("Starting acquisition loop") 
    
    //1 read from the symbols file to determine what data will be acquired 
    log("The following symbols will be processed")
    let syms = ts.io.readJSONFileSync(params.symbol_file) ;  log(syms) 
    check_symbol_directories(syms) //make sure all the directories we need are created 
    
    for ( var sym of syms ) { 
	//process the symbol 
	await process_symbol(sym)
	await util.asnc.wait(params.intra_loop_interval) 
    } 
    
    log("finished acquisition loop") 
} 

async function process_symbol( s : string) {
    // -- 
    log("Processing symbol: " + s) 

    if (params.REQUEST_STATUS != "OK" ) {
	log("REQUEST status was NOT OK")
	log("It was: " + params.REQUEST_STATUS)
	log("Will skip this symbol for now") 
	return 
    } 

    //  GET INFO filenames for reading last trade id 
    let sym_info_dir = ts.io.path.join(params.infodir, sym)
    let sym_info_last_trade_fname = ts.io.path.join(sym_info_dir,params.last_trade_fname) 
    
    var last_id : number = null 
    // try to read the last trade id 
    if (ts.io.fileExists(sym_info_last_trade_fname)) {
	log("Reading last trade id from: " + sym_info_last_trade_fname)
	try { 
	    last_id = Number(ts.io.readJSONFileSync(sym_info_last_trade_fname).value) 
	    log("Success reading file:: "+ last_id) 
	} catch(e) {
	    log("Error reading file:: ")
	    log(e) 
	} 
    }

    // split symbol name to build url 
    let [hdr,sym] = s.split("_")
    let url  = util.symbol_header_to_url(hdr) 
    log(`Got hdr, symbol,url: ${hdr},${sym},${url}`) 

    if (last_id) {
	log("Using last id: " + last_id) 
	
    } else { 
	log("NOT using last id for data request")
	
    } 
    
    
    //TODO finally must WRITE the sym_info_last_trade_fname json file 
    let new_last_trade_id  = null 
    Deno.writeTextFileSync(sym_info_last_trade_fname, JSON.stringify({value : new_last_trade_id}))
    log("Wrote new last trade id= "+ new_last_trade_id) 

} 

function url_request_for_symbol(symbol : string, url : string, last_id? : number) {
    
}


function check_symbol_directories(syms: string[]) { 
    for (var sym of syms) {
	//make sure the info directory exists 
	let sym_info_dir = ts.io.path.join(params.infodir, sym)
	log("Ensuring info directory: " + dir) 
	Deno.mkdirSync(dir , { recursive: true })
	
	let today_fname = Date.iso_day_filename() 
	let tmrw_fname  = Date.to_iso_day_filename(Date.shift_date(new Date(),1,"day"))
	
	let sym_data_dir_today = ts.io.path.join(params.datadir,today_fname,sym)
	let sym_data_dir_tmrw = ts.io.path.join(params.datadir,tmrw_fname,sym)	
	log("Ensuring data directory: " + sym_data_dir_today) 
	Deno.mkdirSync(sym_data_dir_today , { recursive: true })	
	log("Ensuring data directory: " + sym_data_dir_tmrw) 	
	Deno.mkdirSync(sym_data_dir_tmrw , { recursive: true }) 
    } 
} 

function run_initialization() {
    Deno.mkdirSync(params.datadir , { recursive: true });
    Deno.mkdirSync(params.infodir , { recursive: true });    
    
    log("I N I T I A L I Z I N G - - - - - - - > ") 
    
    if (!ts.io.fileExistsSync(params.symbol_file) ) {
	log("Could not find the symbol file at: " + params.symbol_file)
	log("Aborting") 
	Deno.exit(1)  
    } 

    log(`Data dir and info dir: ${params.datadir} , ${params.infodir}`)     
    
    //TODO MAKE SURE THAT the infodir/symbols exists 
    //if not print the error and exit the process 
} 

function get_logger() {
    if (params.log_to_file && params.logfile) { 
	return ts.io.get_logger("dl",params.logfile) 
    }  else { 
	return ts.io.get_logger("dl") 
    } 
} 
