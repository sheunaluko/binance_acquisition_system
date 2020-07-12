//global parameter file 
import {tsd as ts} from "./tsd.ts" 


//all fnames from root of project  
export var datadir = "./data" 
export var infodir = "./info" 


export var logfile = ts.io.path.join(infodir,"logfile") 
export var log_to_file = true 

export var symbol_file = ts.io.path.join(infodir,"symbols.json") 
export var last_trade_fname = "last_trade_id.json" 


export var inter_loop_interval = 1000 //10000 
export var intra_loop_interval = 1000 //10000 

//TODO 
export var futures_aggregated_url = "" 
export var spot_aggregated_url = ""  


export var REQUEST_STATUS = "OK"  // if a request is denied this FLAG is changed so that next caller can know 


