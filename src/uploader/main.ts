
async function upload_file_to_bucket(fname : string,coll : string) {

    //must process the coll name in order to get the path
    let [sym,depth_or_trade] = coll.split("_")
    let path = `${sym}/${depth_or_trade}/${fname.split("/").slice(-1)[0]}`

    log("Uploading file (with compression) to path: " + path) 
    
    let p = Deno.run( {
	cmd : ["gsutil" ,
	       "cp" ,
	       "-z" ,
	       "json" , 
	       fname ,
	       `gs://crypto_market_data_1/${path}`] ,
	stdout : "piped" ,
	stderr : "piped" 
    })

    let upload_info = new TextDecoder().decode(await p.output())

    //delete the file 
    let p2 = Deno.run( { cmd : ["rm" , fname ] }) ; await p2.status() ;
    log("Upload complete and file deleted") 
    
    return upload_info 
}
