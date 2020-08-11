# whoop 

while true 
do  
    echo "[$(date)]:: Sleeping for 1day :) goodbye">> upload.log    
    sleep 1d 
    echo "[$(date)]:: Starting upload loop">> upload.log
    ./bin/upload_files.sh 
done 
