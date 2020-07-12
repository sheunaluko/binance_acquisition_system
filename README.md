# Binance Acquisition System
Easily and automatically download MULTIPLE trading pairs of BOTH futures and spot data from [Binance](https://www.binance.com/en), the world's leading crypto
exchange by volume, straight to your computer with no coding required! 

#### Usage 
1. Install [deno](https://deno.land/) 
2. Clone this repository 
3. Clone the [tidyscripts](https://github.com/sheunaluko/tidyscripts) repository ```adjacent to (NOT inside) /binance_acquisition_system```
4. Edit info/symbols.json to include your desired symbols ```(FUTURES_ETHUSDT, SPOT_ETHBTC, etc...)```
5. Run ./bin/start_dowloader.sh 
6. Data is downloaded in real time over websocket to ```data/DAY/SYMBOL/{FUTURES|SPOT}```

#### Architecture
1. Written in typescript for the Deno runtime, this software connects to Binance via websocket api and retrives aggregate trade data and order book data
in realtime for all symbols defined in info/symbols.json. 
2. Both SPOT and FUTURES data are available. 
3. The data are written straight to JSON text files into the data/
directory on disk as they are acquired 
4. If desired, each day, the previous days data is uploaded to a Google Cloud Storage Bucket for distrubution, and ultimately, analysis.

```Note: I am running this code on a Google Cloud VM for 100% uptime```

#### Motivation 
Cryptocurrency markets are at the cutting edge of modern financial technology. They are rapidly evolving and active 24/7. Because of the highly speculative 
nature of these markets, volatility is significant. Thus, collecting data in real time for future analysis will further research efforts as well as the 
development of real time algorithmic trading bots. 

Contact: alukosheun@gmail.com 

