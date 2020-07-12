//global parameter file 
import {tsd as ts} from "./tsd.ts" 


//all fnames from root of project  
export var datadir = "./data" 
export var infodir = "./info" 


export var logfile = ts.io.path.join(infodir,"logfile") 
export var log_to_file = true 

export var symbol_file = ts.io.path.join(infodir,"symbols.json") 


export var futures_ws_url = "wss://fstream.binance.com/stream?streams="
export var spot_ws_url = "wss://stream.binance.com:9443/stream?streams=" 



export var REQUEST_STATUS = "OK"  // if a request is denied this FLAG is changed so that next caller can know 


