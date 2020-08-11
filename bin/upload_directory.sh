
echo "[$(date)]:: Exporting directory $1" >> upload.log
# run the gsutil command 
gsutil -m mv -z json $1 gs://crypto_market_data_1

# if there was an error then we just leave it  

if [ $? -eq 0 ]
then
  echo "Successfully exported directory $1" >> upload.log
  # in this case we will delete the data 
  rm -rf $1 
  echo "Successfully removed directory $1" >> upload.log  
else
  echo "FAILED to export directory $1" >> upload.log
  echo "Will keep it for your viewing pleasure" >> upload.log  
fi
