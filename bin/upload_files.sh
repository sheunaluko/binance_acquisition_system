# bash script for daily upload of the previous days data 

dirs=`ls data/ -t  | tail -n +2` 

for d in $dirs 
do 
    echo "Exporting dir: data/$d"  >> upload.log 
    ./bin/upload_directory.sh "data/$d"
done     
  
	 

