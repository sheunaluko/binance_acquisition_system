import {tsd as ts} from "../tsd.ts" 


var log = console.log 


if (true) { 
    var ws  = ts.util.WebSocketMaker({ 
    	url : "ws://127.0.0.1:8080"  , 
	
	handler: function(d : any) {
	    //immediately append the acquisition time stamp 
	    //d.data.time = (new Date).getTime() 
	    //send it to be saved 
	    try {
		log("got messsage!") 
		
	    } catch (e) {
		log("Error saving data point: ") 

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


if (false) { 
    var ws  = ts.util.WebSocketMaker({ 
    	url : "wss://stream.binance.com:9443/stream?streams=btcusdt@aggTrade"  , 
	
	handler: function(d : any) {
	    //immediately append the acquisition time stamp 
	    //d.data.time = (new Date).getTime() 
	    //send it to be saved 
	    try {
		log("got messsage!") 
		
	    } catch (e) {
		log("Error saving data point: ") 

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



