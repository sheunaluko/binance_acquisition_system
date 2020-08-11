


/* 
   Validate that a given data file has sequential trade ids 
*/

import {tsd as ts} from "../tsd.ts" 
let fp = ts.util.common.fp 

let log = console.log 

export function validate_file(fname : string) { 
    let text = Deno.readTextFileSync(fname) 
    let toks : any[] = fp.remove_empty(text.split("\n"))
    
    var last_id = JSON.parse(toks[0]).a -1 
    var error = false 

    for (var tok of toks ) { 
	
	let next_id = JSON.parse(tok).a 
	
	if (next_id == last_id + 1) { 
	    log("OK " + next_id) 
	} else { 
	    log("ERROR! => " + next_id)
	    error = true 
	} 
	
	last_id = next_id 
    } 
    
    error ? log("FAILED") : log("SUCCESS"); 
    
    /*
    let data = toks.map(JSON.parse)
    let ids  = fp.map_get(data,"a") 
    let id_diff = fp.diff(ids) 
    
    let diffs = new Set(id_diff) 
    
    let valid = (diffs.has(1) && (diffs.size == 1 )) 
    
    console.log("\nResults for file= " + fname ) 
    console.log("Validity= " + valid) 
    console.log("diffs=>") 
    console.log(diffs) 
    */ 
} 


validate_file(Deno.args[0]) 
