dirs="$(ls data/ -t  | tail -n +2)"

for d in $dirs 
do 
    echo "Exporting dir: data/$d"  >> upload.log 
    ./bin/upload_directory.sh "data/$d"
done     
