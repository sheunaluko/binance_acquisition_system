#!/bin/bash 
# make sure a process is always running.  

process=start_download 
makerun="/home/oluwa/binance_acquisition_system/bin/start_download.sh"  

#launch the process 
$makerun &         

#start the loop to check it 

while true 
do 
    sleep 0.5
    if pgrep $process > /dev/null         
    then                 
	#echo "$(date) = process active"
	true 
    else         
	#have to restart the process now 
	echo "process needs to be started" 
	$makerun &         
    fi 
done
