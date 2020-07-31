
import * as params from "../parameters.ts" 
import {tsd as ts} from "../tsd.ts" 
let asnc = ts.util.common.asnc //async helpers 
let WebSocket = ts.base.WebSocket 


export function get_ws(url : string, cb  : any, log: any) { 
    var ws : any = null ; 
    async function init() { 
	ws = new WebSocket(url) 
	ws.on("open" , function(){
	    log("Ws to url: " + url + " has been opened")
	})
	ws.on("close" , function(){
	    log("Ws to url: " + url + " has been closed")	    
	})
	ws.on("error" , function(e : any){
	    log("Ws to url: " + url + " had error:")	    
	    log(e) 
	})
	ws.on("message", function(message : string) {
	    cb(JSON.parse(message))
	})
    }
    init() 
    return ws 
} 

export function get_reconnecting_ws(url : string, cb  : any, log: any) { 
    
    var ws : any = null ; 
    
    async function init() { 
	
	await asnc.wait(1000) 
	
	ws = new WebSocket(url) 
	
	ws.on("open" , function(){
	    log("Ws to url: " + url + " has been opened")
	})
	
	ws.on("close" , function(){
	    
	    log("Ws to url: " + url + " has been closed")	    
	    log("Attempting reconnect")
	    
	    init() 
	    
	})
	
	ws.on("error" , function(e : any){
	    
	    log("Ws to url: " + url + " had error:")	    
	    log(e) 
	    log("Attempting reconnect")
	    
	    init() 
	    
	})
	
		
	ws.on("message", function(message : string) {
	    cb(JSON.parse(message))
	})

    }
    
    init() 
    
    
    return ws 
} 

export {asnc} 
