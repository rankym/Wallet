const ParseData = {
    Orderbook(Server, baseBuying, counterSelling, onUpdate, limit) {
        this.ready = false;
        const initialOrderbook = Server.orderbook(baseBuying, baseBuying).call()
            .then((res) => {
                this.asks = res.asks;
                this.bids = res.bids;
                this.baseBuying = baseBuying;
                this.counterSelling = counterSelling;
                this.ready = true;
                onUpdate();
                // console.log("res", res);
            });
        let streamingOrderbookClose = Server.orderbook(baseBuying, counterSelling, limit)
            .stream({
                onmessage: res => {
                    let updated = false;
                    if (!_.isEqual(this.bids, res.bids)) {
                        this.bids = res.bids;
                        updated = true;
                    }
                    if (!_.isEqual(this.asks, res.asks)) {
                        this.asks = res.asks;
                        updated = true;
                    }
                    if (updated) {
                        onUpdate();
                    }
                }
            })
        let smoothTrades = (trades) => {
            let result = [];
            for (let i = 2; i < trades.length; i++) {
                let a = Number(trades[i-2][1]);
                let b = Number(trades[i-1][1]);
                let c = Number(trades[i  ][1]);

                let ratioA = c/a;
                let ratioB = c/b;
                let geometricAbsoluteDiffA = ratioA > 1 ? ratioA - 1 : 1/ratioA - 1;
                let geometricAbsoluteDiffB = ratioB > 1 ? ratioB - 1 : 1/ratioB - 1;
                if (geometricAbsoluteDiffA > 0.3 && geometricAbsoluteDiffB > 0.3) {

                    result.push([trades[i][0], [a,b,c].sort()[1]]);

                } else {
                    result.push(trades[i]);
                }
            }
            return result
        }

        let firstFullFetchFinished = false;
        let fetchManyTrades = async () => {
            let records = [];
            let satisfied = false;
            let first = true;
            let depth = 0;
            const MAX_DEPTH = 20;
            let prevCall;
            let startTime = Date.now();
            let fetchTimeout = 20000; // milliseconds before we stop fetching history
            let nowDate = Date.now() + 86400000;
            let result;

            while (!this.closed && !satisfied && depth < MAX_DEPTH && Date.now() - startTime < fetchTimeout) {
                depth += 1;
                let tradeResults;
                if (first) {
                    tradeResults = await Server.tradeAggregation(baseBuying, counterSelling, 1514764800, Date.now() + 86400000, 900000).limit(200).order('desc').call()

                    first = false;
                    // console.log("Server", tradeResults);
                }
                else {

                    tradeResults = await prevCall();
                }

                prevCall = tradeResults.next;

                // console.log("tradeResults", tradeResults.records);
                records.push(...tradeResults.records);
                if (tradeResults.records.length < 200) {
                    satisfied = true;
                }


                // Optimization: use this filter before saving it into the records array
                result = _.filter(
                    _.map(records, (trade) => {
                        return [new Date(trade.timestamp).getTime(), parseFloat(trade.close)];
                    }),
                    (entry) => {
                        return !isNaN(entry[1]);
                    }
                );
                result.sort((a,b) => {
                    return a[0]-b[0];
                });
                if (!firstFullFetchFinished) {
                    this.trades = smoothTrades(result);
                }
                if (depth > 1) {
                    onUpdate();
                }
            }
            firstFullFetchFinished = true;
            this.trades = smoothTrades(result);
            onUpdate();

            setTimeout(() => {
                if (!this.closed) {
                    fetchManyTrades();
                }
            }, 5*60*1000);
        }

        fetchManyTrades();

        this.close = () => {
            this.closed = true;
            streamingOrderbookClose;
        }
    },

};
export default ParseData;