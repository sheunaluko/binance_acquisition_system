import pandas as pd
import numpy as np
import holoviews as hv
from holoviews import opts,dim
import matplotlib as plt 
import colorcet as cc
import functools as ft
import operator as ops 
import os 
import json 
import bokeh 

from bokeh.plotting import figure



# crypto analysis using python
datadir = "crypto_market_data_1"
cachedir = "cache"
folders = os.listdir(datadir)

# get the full fname of a specific file 
def get_fname(day,pair,futures_or_spot, ftype) : 
         return "{}/{}/{}/{}/{}_{}.json".format(datadir,day,pair,futures_or_spot,pair,ftype)

# read a text file 
def read_text_file(fname) : 
    with open(fname, 'r') as file:
        return file.read()

def read_dictionary_string(s) : 
    d = json.loads(s) 
    r = {} 
    r['p'] = float(d['p'])
    r['q'] = float(d['q'])
    r['m'] = d['m']
    r['epoch_time_ms'] = float(d['T'])
    return r 

def extract_data_from_file(day,pair,futures_or_spot, ftype) :  
    # get the text of the file 
    fstr = read_text_file(get_fname(day,pair,futures_or_spot, ftype)) 
    # parse it into a pandas dataframe 
    data =  pd.DataFrame([ read_dictionary_string(x) for x in fstr.split("\n") if x != "" ])    
    
    # convert the epoch times (currently floats) into timestamps 
    data =  data.assign(tms = pd.to_datetime(data['epoch_time_ms'], unit='ms'))
    # calculate the volume of the trade in units of the quote asset 
    # (i.e the quantity - base asset - multiplied by price) 
    data = data.assign(v=data['q'] * data['p'])
    return data 

def extract_data_from_file_with_tbins(day,pair,futures_or_spot, ftype, aggregate="T") :  
    data = extract_data_from_file(day,pair,futures_or_spot, ftype) 
    data = data.assign(tbin= lambda x: x['tms'].round(aggregate))
    return data 

def trade_aggregator(df) :  
    """
    Function that aggregates trades over a given interval. It does not check the interval kength - it only summarizes the data that is within each group 
    Will likely keep contributing summary statistics over time as this modular approach allows for maintainability 
    """
    
    p = df['p']
    p_avg = np.mean(p) 
    p_max = np.max(p)
    p_min = np.min(p)
    p_range = p_max - p_min
    p_open = df.iloc[0].p
    p_close = df.iloc[-1].p 
    p_change = p_close - p_open 
    p_change_percent = 100*p_change/p_open 
    p_range_percent  = p_range/p_open #not sure if denom should be open or min 
   

    # NOTE - q represents 'quanity' of the base asset (pair= base/quote). 
    # v represents the 'volume' or amount of the trade denominated in quote asset 
    # which would be price * quantity 
    
    df_sell = df[df['m']== True] # "buyer is market maker"
    q_sell_tot  = np.sum(df_sell['q'])
    q_sell_max  = np.max(df_sell['q'])
    v_sell_tot  = np.sum(df_sell['v'])
    v_sell_max  = np.max(df_sell['v'])
    
    df_buy = df[df['m']== False]
    q_buy_tot   = np.sum(df_buy['q'] )
    q_buy_max  = np.max(df_buy['q'] )
    v_buy_tot   = np.sum(df_buy['v'] )
    v_buy_max  = np.max(df_buy['v'] )

    q_tot = np.sum(df['q']) 
    v_tot = np.sum(df['v']) 
    
    q_net = q_buy_tot - q_sell_tot
    v_net = v_buy_tot - v_sell_tot 
    
    return pd.DataFrame([{
        'p_avg' : p_avg, 
        'p_max' : p_max, 
        'p_min' : p_min, 
        'p_range' : p_range, 
        'p_open' : p_open, 
        'p_close' : p_close, 
        'p_change' : p_change, 
        'p_change_percent' : p_change_percent, 
        'p_range_percent' : p_range_percent, 
        'q_sell_tot' : q_sell_tot , 
        'q_sell_max' : q_sell_max,  
        'q_buy_tot' : q_buy_tot, 
        'q_buy_max' : q_buy_max ,
        'q_tot' : q_tot , 
        'q_net' : q_net, 
        'v_sell_tot' : v_sell_tot , 
        'v_sell_max' : v_sell_max,  
        'v_buy_tot' : v_buy_tot, 
        'v_buy_max' : v_buy_max ,
        'v_tot' : v_tot , 
        'v_net' : v_net, 
    }])

def extract_tbinned_data_from_file(day,pair,futures_or_spot, ftype, aggregate="T") : 
    
    # this function will load aggregated and summarized data, and if it has already been loaded then it will returned the cached version
    # this is good, however if the 'trade_aggregator' function is changed then the cache will incorrectly return an old value 
    
    # will have to think how to mitigate this 
    
    # I think i will start by employing a direct caching technique right here 
    # each unique access will be defined by the access_id
    caching = True 
    access_id = "_".join([day,pair,futures_or_spot,ftype,aggregate])  + ".pkl"  # the access id is actually a filepath (basename) on disk 
    access_namespace = "extract_tbinned_data_from_file" #the namespace is the first subdirectory in the cachedir root directory 
    
    dirname = os.path.join(cachedir,access_namespace) 
    os.makedirs(dirname, exist_ok=True)
    fname = os.path.join(dirname,access_id)
    print("cache req: {}".format(fname)) 
        
    if caching and os.path.exists(fname) : 
        # if the file exists this is considered a cache hit 
        print("cache hit!")
        # parse the file and get the data 
        data = pd.read_pickle(fname) 
        # note that even though we are reading the data from disk this should be much faster as it is a 
        # binary stored formate of aggregated trades, rather than the raw format of strings reprenting individual trades as below 
        return data 
     
    # if we are here then its a cache miss ... 
    print("cache miss! ~> proceeding with request ")
    # extract data from the original text file format 
    data =  extract_data_from_file_with_tbins(day,pair,futures_or_spot, ftype, aggregate="T") # hmm... dont want to keep repeating this; it reads a large text file of individual trades into a stringg, splits by "\n",parses each chunk to json and. then adds tbin column by rounding the epoch times 
    data_tbinned = data.groupby(['tbin']).apply(trade_aggregator).reset_index()  # this aggregation option is something wwe also dont want to repeat again
    
    # can add additional information to the dataframe here 
    # cummulative sums over the day 
    data_tbinned = data_tbinned.assign(v_buy_cumulative=data_tbinned['v_buy_tot'].cumsum())
    data_tbinned = data_tbinned.assign(v_sell_cumulative=data_tbinned['v_sell_tot'].cumsum())
    data_tbinned = data_tbinned.assign(v_tot_cumulative=data_tbinned['v_tot'].cumsum()) 
    
    # did the price increase over the interval?  
    data_tbinned = data_tbinned.assign(inc= (data_tbinned['p_close'] > data_tbinned['p_open'] ) )
    data_tbinned = data_tbinned.assign(dec= (data_tbinned['p_open'] > data_tbinned['p_close'] ) )
        
    # -  
    
    # can also go ahead and calculate the moving averages 
    # later I will implement MVAs over the whole available dataseries for the pair
    
    mva_7 = data_tbinned.p_avg.rolling(7).mean()
    mva_25 = data_tbinned.p_avg.rolling(25).mean()
    mva_99 = data_tbinned.p_avg.rolling(99).mean()
    
    data_tbinned = data_tbinned.assign(mva_7=mva_7,mva_25=mva_25,mva_99=mva_99)

    # - and rest the index too 
    data_tbinned = data_tbinned.reset_index()
    
    # and finally we have to store the cached data prior to returning 
    data_tbinned.to_pickle(fname)
    print("cache: wrote: {}".format(fname)) 
    
    return data_tbinned 

def get_future_spot_compared_data(day,pair,aggregate='T') : 
    print("Extracting futures data")
    f = extract_tbinned_data_from_file(day,pair,"FUTURES","TRADE", aggregate) 
    print("Extracting spot data")
    s = extract_tbinned_data_from_file(day,pair,"SPOT","TRADE", aggregate) 
    
    p_avg_diff = f['p_avg'] - s['p_avg']  
    p_mean = (f['p_avg'] + s['p_avg'])/2 
    p_avg_diff_percent = 100*p_avg_diff/p_mean 
    compared = pd.DataFrame({ 
        'tbin' : f['tbin'] , 
        'p_avg_diff' : p_avg_diff, 
        'p_avg_diff_percent' : p_avg_diff_percent, 
        'v_tot_diff' : f['v_tot']  - s['v_tot'] , 
        'v_sell_tot_diff' : f['v_sell_tot'] - s['v_sell_tot'] , 
        'v_buy_tot_diff' : f['v_buy_tot'] - s['v_buy_tot'] , 
        'p_percent_diff' : f['p_change_percent'] - s['p_change_percent'], 
        'v_net_diff' : f['v_net'] - s['v_net'] , 
    })
    return (f,s,compared) 

def convert_future_spot_compare_to_ds(f,s,c) :  
    c_ds = hv.Dataset(c, kdims=['tbin'],vdims=['p_avg_diff','p_avg_diff_percent','v_tot_diff','p_percent_diff','v_net_diff'])
    f_ds = hv.Dataset(f, kdims=['tbin'], vdims=['p_avg','p_change', 'p_change_percent', 'v_sell_tot', 'v_buy_tot' , 'v_tot','v_net','v_buy_cumulative','v_sell_cumulative','v_tot_cumulative'])
    s_ds = hv.Dataset(s, kdims=['tbin'], vdims=['p_avg','p_change', 'p_change_percent', 'v_sell_tot', 'v_buy_tot' , 'v_tot','v_net','v_buy_cumulative','v_sell_cumulative','v_tot_cumulative'])
    return (f_ds,s_ds,c_ds)    

def rsz(graph,x) : 
        return graph.options(width=x[0],height=x[1])

default_width = 1300 

def analyze_future_spot(day,pair,aggregate="T") : 
    (f, s, c)         = get_future_spot_compared_data(day,pair,aggregate) # get the data 
    (f_ds, s_ds, c_ds )  = convert_future_spot_compare_to_ds(f,s,c) # convert it to hv objects 

    # time to visualize now 
    l1 = hv.Curve(c_ds,'tbin','p_avg_diff_percent',)
    l2 = hv.Curve(f_ds,'tbin', 'v_net',label='futures') * hv.Curve(s_ds,'tbin','v_net',label='spot')
    #l3 = hv.Curve(f_ds,'tbin','v_sell_tot') 
    graphs = [l1,l2]

    s1 = f_ds.to(hv.Curve,'tbin','p_avg',label='futures') 
    s2 = s_ds.to(hv.Curve,'tbin','p_avg', label='spot')
    price_graph = ft.reduce(ops.mul, [rsz(x,(default_width,400)) for x in [s1,s2]] )
   
    diff_graphs = ft.reduce(ops.add, [rsz(x,(default_width,200)) for x in graphs] ).cols(1)  
    return ((price_graph, diff_graphs), f, s, c, f_ds,s_ds,c_ds )

def compare_futures_spot_v_vs_dp(f_ds,s_ds) : 
    # futures 
    s1 = hv.Scatter(f_ds,'v_net','p_change_percent',label='futures')
    s2 = hv.Scatter(s_ds,'v_net','p_change_percent',label='spot')
    gs = [s1,s2]
    return ft.reduce(ops.add, [rsz(x,(int(default_width/2),500)) for x in gs]).cols(2)

def epoch_graph_for_df(s,label=None) :
    s['epoch'] = s['tbin'].apply(lambda x:x.value) 
    s['index'] = np.arange(len(s))

    new_ds = hv.Dataset(s,kdims=["index"],vdims=["epoch"]) 
    g = rsz(hv.Curve(new_ds,'index','epoch',label=label), (default_width,300)) 
    return (g,new_ds) 


def futures_spot_epoch_graph(f,s) : 
    (sg,snds) = epoch_graph_for_df(s,"spot")
    (fg,fnds) = epoch_graph_for_df(f,"futures") 
    g = sg*fg
    return (g,fg,fnds,sg,snds) 
    
    
def futures_spot_total_v(f_ds,s_ds)     : 
    sz=(default_width,400)
    return rsz(f_ds.to(hv.Curve,'tbin', 'v_tot',label='futures'),sz) *  rsz(s_ds.to(hv.Curve,'tbin', 'v_tot',label='spot'),sz)




def get_runs(df) : 
    
    # want to make a function which quantifies the runs 
    # one cool way would be to start by just tagging each row with the ID of the run that it is part of 
    # run_id (epoch ms of tstart of run) 
    # run_is_positive (boolean which is True if the run is part of an increasing price movement) 

    from math import pi
    from bokeh.palettes import Category20c
    from bokeh.plotting import figure
    from bokeh.transform import cumsum
    runs_df = df.get(["tbin","inc","dec"])
    # can do this in a stateful way: 
    runs = [] 
    run_is_positive = None 
    curr_run = None 
    run_ids = np.zeros(len(df)) 
    nrows = len(df)

    for index, row in df.iterrows():

        #print("Progress: {}/{}".format(index,nrows))

        inc = row['inc']
        dec = row['dec'] 
        t   = row['tbin'] 

        if index == 0 : 
            # first row 
            # create the first run and then return 
            curr_run = { 
                'id' : 0 , 
                'run_is_positive' : (True if inc else False) , 
                'tbin' :  t , 
                'index' : 0 , 
            }
            continue   


        # now we check if the current state 
        is_increasing = inc 
        if curr_run['run_is_positive'] : 
            if is_increasing : 
                # we are continuing the current run 
                # which means that the run id is the same 
                run_ids[index] = curr_run['id']
            else : 
                # we were increasing but now are decreasing 
                # so the previous run has ended and we should start a new run 
                # we need to do the following: 
                # 1) add the current run to the runs array  (after updating its length)
                curr_run['length']  = (index - curr_run['index'])
                runs.append(curr_run) 
                new_id = curr_run['id'] + 1
                # 2) create a new current run
                curr_run = {
                    'id' : new_id, 
                    'run_is_positive' : False , 
                    'tbin' : t , 
                    'index' : index, 
                }
                # 3) update the run_ids col 
                run_ids[index] = new_id 
                # thats it for this case 
        else : 
            # current run is actually decreasing 
            # we will a sort of mirrored logic here 
            if not is_increasing : 
                # we are continuing the current run 
                # which means that the run id is the same 
                run_ids[index] = curr_run['id']
            else : 
                # we were decreasing but now are increasing 
                # so the previous run has ended and we should start a new run 
                # we need to do the following: 
                # 1) add the current run to the runs array  
                curr_run['length']  = (index - curr_run['index'])
                runs.append(curr_run) 
                new_id = curr_run['id'] + 1
                # 2) create a new current run
                curr_run = {
                    'id' : new_id, 
                    'run_is_positive' : True , 
                    'tbin' : t , 
                    'index'  : index,
                }
                # 3) update the run_ids col 
                run_ids[index] = new_id 
                # thats it for this case     
                
    return pd.DataFrame(runs)


def analyze_runs(runs_df) : 
    
    from bokeh.io import output_file, show
    from bokeh.palettes import Category20c
    from bokeh.plotting import figure
    from bokeh.transform import cumsum

    x = runs_df["length"].value_counts()
    data = pd.Series(x).reset_index(name='value').rename(columns={'index':'length'})
    data['angle'] = data['value']/data['value'].sum() * 2*np.pi
    data['color'] = bokeh.palettes.Category20c[len(x)]
    p = figure(plot_height=350, title="Pie Chart", toolbar_location=None,
               tools="hover", tooltips="@length: @value", x_range=(-0.5, 1.0))
    p.wedge(x=0, y=1, radius=0.4,
            start_angle=cumsum('angle', include_zero=True), end_angle=cumsum('angle'),
            line_color="white", fill_color='color', legend_field='length', source=data)
    p.axis.axis_label=None
    p.axis.visible=False
    p.grid.grid_line_color = None
    
    return p



def to_hv_dataset(df) : 
    return hv.Dataset(df,kdims=['tbin'],vdims=list(df.columns)[2:])



def add_run_info_to_df(ads,runs_df) : 
    """
    Takes a data frame of aggregated trading info as well as a dataframe which describes its runs and appends run information to the first dataframe.
    This includes two columns: 
    run_id     - the index of the START of the associated run (in context of ads)
    run_index  - the index WITHIN the current run (in context of run_id) 
    """
  
    # to accomplish this I need to repeat the index of each run start for len(run) times to generate a new column 
    # then to get the run index I just do index mod new column 
    
    # build the column here 
    run_id = np.zeros(len(ads))
    for i,row in runs_df.iterrows() : 
        start = row['index']
        l     = row['length']
        run_id[start:start+l] = np.repeat(start,l)
        
    ads['run_id'] = run_id 
        
    # do mod to assign run index 
    ads = ads.assign(run_index=lambda x: x['index'] % x['run_id'] ) 
    # fix the zero ones 
    select0=(ads['run_id']==0)
    ads.loc[select0,'run_index'] = ads[select0]['index']
        
    return ads 

def get_data_for_run(df,run_info) : 
    #print("Getting data for run:") 
    #print(run_info)
    s = run_info['index']
    e = run_info['length'] + s 
    ret = df.iloc[s:e]
    ret = ret.assign(index=range(len(ret)))
    return ret


def return_vs_run_index(adsr,sz=(600,600)) : 
    ards = hv.Dataset(adsr,kdims=['run_index'], vdims=['p_change_percent']) # convert to hv dataset 
    p = rsz(ards.to(hv.Scatter,'run_index' , 'p_change_percent').opts(size=3,jitter=0.2,xlim=(-1,20),title="Return vs Run Index"), sz)
    return p 
    
    

def get_all_days_binned(pair,futures_or_spot,ftype,aggregate="T") : 
    fldrs = folders 
    fldrs.sort()
    results = [ extract_tbinned_data_from_file(day,pair,futures_or_spot, ftype, aggregate) for day in fldrs ] 
        
    # need to combine them into one big dataframe 
    results = ft.reduce(lambda x,y: pd.concat([x,y],ignore_index=True),results )
    results['index'] =results.index.tolist() 
    return results 