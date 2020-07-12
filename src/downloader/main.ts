// main deno script for downloading 

import * as params from "../parameters.ts" 
import {tsd as ts} from "../tsd.ts" 
import * as util from "./util.ts" 
let date = ts.util.common.Date 
let fp = ts.util.common.fp 

/* first check logging */  
let log = get_logger() 

/*  initialize directories, other stuff  */
run_initialization() 

/* start stuff  */ 
log("Initializing") 


main()



// -------------------------------------------------- 

async function main() {

    let symbol_data = process_symbol_file() 
    
    log("Retrieved the following symbol data") 
    log(symbol_data) 
    
    let spot_ws_url = params.spot_ws_url + syms_to_agg_sym_array(symbol_data.SPOT) +  syms_to_partial_depth_sym_array(symbol_data.SPOT,"1000")
    
    let futures_ws_url = params.futures_ws_url + syms_to_agg_sym_array(symbol_data.FUTURES) + syms_to_partial_depth_sym_array(symbol_data.FUTURES,"500")  + syms_mark_sym_array(symbol_data.FUTURES)

    log("Will use spot url:: " + spot_ws_url) 
    log("Will use futures url:: " + futures_ws_url) 
    
    let spot_ws = util.get_reconnecting_ws(spot_ws_url, function(d : any) {
	//immediately append the acquisition time stamp 
	d.data.time = (new Date).getTime() 
	//send it to be saved 
	try {
	    save_handler(d,"SPOT")
	    
	} catch (e) {
	    log("Error saving data point: ") 
	    log(d) 
	    log(e)
	} 
    } , log)
    
    
     let futures_ws = util.get_reconnecting_ws(futures_ws_url, function(d : any) {
	//immediately append the acquisition time stamp 
	d.data.time = (new Date).getTime() 
	 
	//send it to be saved 
	try {
	    save_handler(d,"FUTURES")
	    
	} catch (e) {
	    log("Error saving data point: ") 
	    log(d) 
	    log(e)
	} 

    } , log)
    
    
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
    
    log("I N I T I A L I Z I N G - - - - - - - > ") 
    
    if (!ts.io.fileExistsSync(params.symbol_file) ) {
	log("Could not find the symbol file at: " + params.symbol_file)
	log("Aborting") 
	Deno.exit(1)  
    } 

    log(`Data dir and info dir: ${params.datadir} , ${params.infodir}`)     
    
    
    log("The following symbols will be processed")
    let syms = ts.io.readJSONFileSync(params.symbol_file) ;  log(syms) 
    check_symbol_directories(syms) //make sure all the directories we need are created 

} 

function get_logger() {
    if (params.log_to_file && params.logfile) { 
	return ts.io.get_logger("dl",params.logfile) 
    }  else { 
	return ts.io.get_logger("dl") 
    } 
} 
