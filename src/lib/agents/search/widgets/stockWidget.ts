import z from 'zod';
import { Widget } from '../types';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

const schema = z.object({
  type: z.literal('stock'),
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol in uppercase (e.g., 'AAPL' for Apple Inc., 'TSLA' for Tesla, 'GOOGL' for Google). Use the primary exchange ticker.",
    ),
  comparisonTickers: z
    .array(z.string())
    .max(3)
    .describe(
      "Optional array of up to 3 ticker symbols to compare against the base ticker (e.g., ['MSFT', 'GOOGL', 'META']). Charts will show percentage change comparison.",
    ),
});

const stockWidget: Widget<typeof schema> = {
  name: 'stock',
  description: `Provides comprehensive real-time stock market data and financial information for any publicly traded company. Returns detailed quote data, market status, trading metrics, and company fundamentals.

You can set skipSearch to true if the stock widget can fully answer the user's query without needing additional web search.

**What it provides:**
- **Real-time Price Data**: Current price, previous close, open price, day's range (high/low)
- **Market Status**: Whether market is currently open or closed, trading sessions
- **Trading Metrics**: Volume, average volume, bid/ask prices and sizes
- **Performance**: Price changes (absolute and percentage), 52-week high/low range
- **Valuation**: Market capitalization, P/E ratio, earnings per share (EPS)
- **Dividends**: Dividend rate, dividend yield, ex-dividend date
- **Company Info**: Full company name, exchange, currency, sector/industry (when available)
- **Advanced Metrics**: Beta, trailing/forward P/E, book value, price-to-book ratio
- **Charts Data**: Historical price movements for visualization
- **Comparison**: Compare up to 3 stocks side-by-side with percentage-based performance visualization

**When to use:**
- User asks about a stock price ("What's AAPL stock price?", "How is Tesla doing?")
- Questions about company market performance ("Is Microsoft up or down today?")
- Requests for stock market data, trading info, or company valuation
- Queries about dividends, P/E ratio, market cap, or other financial metrics
- Any stock/equity-related question for a specific company
- Stock comparisons ("Compare AAPL vs MSFT", "How is TSLA doing vs RIVN and LCID?")

**Example calls:**
{
  "type": "stock",
  "ticker": "AAPL"
}

{
  "type": "stock",
  "ticker": "TSLA",
  "comparisonTickers": ["RIVN", "LCID"]
}

{
  "type": "stock",
  "ticker": "GOOGL",
  "comparisonTickers": ["MSFT", "META", "AMZN"]
}

**Important:** 
- Use the correct ticker symbol (uppercase preferred: AAPL not aapl)
- For companies with multiple share classes, use the most common one (e.g., GOOGL for Google Class A shares)
- The widget works for stocks listed on major exchanges (NYSE, NASDAQ, etc.)
- Returns comprehensive data; the UI will display relevant metrics based on availability
- Market data may be delayed by 15-20 minutes for free data sources during trading hours`,
  schema: schema,
  execute: async (params, _) => {
    try {
      const ticker = params.ticker.toUpperCase();

      const quote: any = await yf.quote(ticker);

      const chartPromises = {
        '1D': yf
          .chart(ticker, {
            period1: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            period2: new Date(),
            interval: '5m',
          })
          .catch(() => null),
        '5D': yf
          .chart(ticker, {
            period1: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
            period2: new Date(),
            interval: '15m',
          })
          .catch(() => null),
        '1M': yf
          .chart(ticker, {
            period1: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            interval: '1d',
          })
          .catch(() => null),
        '3M': yf
          .chart(ticker, {
            period1: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            interval: '1d',
          })
          .catch(() => null),
        '6M': yf
          .chart(ticker, {
            period1: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
            interval: '1d',
          })
          .catch(() => null),
        '1Y': yf
          .chart(ticker, {
            period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            interval: '1d',
          })
          .catch(() => null),
        MAX: yf
          .chart(ticker, {
            period1: new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000),
            interval: '1wk',
          })
          .catch(() => null),
      };

      const charts = await Promise.all([
        chartPromises['1D'],
        chartPromises['5D'],
        chartPromises['1M'],
        chartPromises['3M'],
        chartPromises['6M'],
        chartPromises['1Y'],
        chartPromises['MAX'],
      ]);

      const [chart1D, chart5D, chart1M, chart3M, chart6M, chart1Y, chartMAX] =
        charts;

      if (!quote) {
        throw new Error(`No data found for ticker: ${ticker}`);
      }

      let comparisonData: any = null;
      if (params.comparisonTickers.length > 0) {
        const comparisonPromises = params.comparisonTickers
          .slice(0, 3)
          .map(async (compTicker) => {
            try {
              const compQuote = await yf.quote(compTicker);
              const compCharts = await Promise.all([
                yf
                  .chart(compTicker, {
                    period1: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                    period2: new Date(),
                    interval: '5m',
                  })
                  .catch(() => null),
                yf
                  .chart(compTicker, {
                    period1: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
                    period2: new Date(),
                    interval: '15m',
                  })
                  .catch(() => null),
                yf
                  .chart(compTicker, {
                    period1: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    interval: '1d',
                  })
                  .catch(() => null),
                yf
                  .chart(compTicker, {
                    period1: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                    interval: '1d',
                  })
                  .catch(() => null),
                yf
                  .chart(compTicker, {
                    period1: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
                    interval: '1d',
                  })
                  .catch(() => null),
                yf
                  .chart(compTicker, {
                    period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
                    interval: '1d',
                  })
                  .catch(() => null),
                yf
                  .chart(compTicker, {
                    period1: new Date(
                      Date.now() - 10 * 365 * 24 * 60 * 60 * 1000,
                    ),
                    interval: '1wk',
                  })
                  .catch(() => null),
              ]);
              return {
                ticker: compTicker,
                name: compQuote.shortName || compTicker,
                charts: compCharts,
              };
            } catch (error) {
              console.error(
                `Failed to fetch comparison ticker ${compTicker}:`,
                error,
              );
              return null;
            }
          });
        const compResults = await Promise.all(comparisonPromises);
        comparisonData = compResults.filter((r) => r !== null);
      }

      const stockData = {
        symbol: quote.symbol,
        shortName: quote.shortName || quote.longName || ticker,
        longName: quote.longName,
        exchange: quote.fullExchangeName || quote.exchange,
        currency: quote.currency,
        quoteType: quote.quoteType,

        marketState: quote.marketState,
        regularMarketTime: quote.regularMarketTime,
        postMarketTime: quote.postMarketTime,
        preMarketTime: quote.preMarketTime,

        regularMarketPrice: quote.regularMarketPrice,
        regularMarketChange: quote.regularMarketChange,
        regularMarketChangePercent: quote.regularMarketChangePercent,
        regularMarketPreviousClose: quote.regularMarketPreviousClose,
        regularMarketOpen: quote.regularMarketOpen,
        regularMarketDayHigh: quote.regularMarketDayHigh,
        regularMarketDayLow: quote.regularMarketDayLow,

        postMarketPrice: quote.postMarketPrice,
        postMarketChange: quote.postMarketChange,
        postMarketChangePercent: quote.postMarketChangePercent,
        preMarketPrice: quote.preMarketPrice,
        preMarketChange: quote.preMarketChange,
        preMarketChangePercent: quote.preMarketChangePercent,

        regularMarketVolume: quote.regularMarketVolume,
        averageDailyVolume3Month: quote.averageDailyVolume3Month,
        averageDailyVolume10Day: quote.averageDailyVolume10Day,
        bid: quote.bid,
        bidSize: quote.bidSize,
        ask: quote.ask,
        askSize: quote.askSize,

        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekChange: quote.fiftyTwoWeekChange,
        fiftyTwoWeekChangePercent: quote.fiftyTwoWeekChangePercent,

        marketCap: quote.marketCap,
        trailingPE: quote.trailingPE,
        forwardPE: quote.forwardPE,
        priceToBook: quote.priceToBook,
        bookValue: quote.bookValue,
        earningsPerShare: quote.epsTrailingTwelveMonths,
        epsForward: quote.epsForward,

        dividendRate: quote.dividendRate,
        dividendYield: quote.dividendYield,
        exDividendDate: quote.exDividendDate,
        trailingAnnualDividendRate: quote.trailingAnnualDividendRate,
        trailingAnnualDividendYield: quote.trailingAnnualDividendYield,

        beta: quote.beta,

        fiftyDayAverage: quote.fiftyDayAverage,
        fiftyDayAverageChange: quote.fiftyDayAverageChange,
        fiftyDayAverageChangePercent: quote.fiftyDayAverageChangePercent,
        twoHundredDayAverage: quote.twoHundredDayAverage,
        twoHundredDayAverageChange: quote.twoHundredDayAverageChange,
        twoHundredDayAverageChangePercent:
          quote.twoHundredDayAverageChangePercent,

        sector: quote.sector,
        industry: quote.industry,
        website: quote.website,

        chartData: {
          '1D': chart1D
            ? {
              timestamps: chart1D.quotes.map((q: any) => q.date.getTime()),
              prices: chart1D.quotes.map((q: any) => q.close),
            }
            : null,
          '5D': chart5D
            ? {
              timestamps: chart5D.quotes.map((q: any) => q.date.getTime()),
              prices: chart5D.quotes.map((q: any) => q.close),
            }
            : null,
          '1M': chart1M
            ? {
              timestamps: chart1M.quotes.map((q: any) => q.date.getTime()),
              prices: chart1M.quotes.map((q: any) => q.close),
            }
            : null,
          '3M': chart3M
            ? {
              timestamps: chart3M.quotes.map((q: any) => q.date.getTime()),
              prices: chart3M.quotes.map((q: any) => q.close),
            }
            : null,
          '6M': chart6M
            ? {
              timestamps: chart6M.quotes.map((q: any) => q.date.getTime()),
              prices: chart6M.quotes.map((q: any) => q.close),
            }
            : null,
          '1Y': chart1Y
            ? {
              timestamps: chart1Y.quotes.map((q: any) => q.date.getTime()),
              prices: chart1Y.quotes.map((q: any) => q.close),
            }
            : null,
          MAX: chartMAX
            ? {
              timestamps: chartMAX.quotes.map((q: any) => q.date.getTime()),
              prices: chartMAX.quotes.map((q: any) => q.close),
            }
            : null,
        },
        comparisonData: comparisonData
          ? comparisonData.map((comp: any) => ({
            ticker: comp.ticker,
            name: comp.name,
            chartData: {
              '1D': comp.charts[0]
                ? {
                  timestamps: comp.charts[0].quotes.map((q: any) =>
                    q.date.getTime(),
                  ),
                  prices: comp.charts[0].quotes.map((q: any) => q.close),
                }
                : null,
              '5D': comp.charts[1]
                ? {
                  timestamps: comp.charts[1].quotes.map((q: any) =>
                    q.date.getTime(),
                  ),
                  prices: comp.charts[1].quotes.map((q: any) => q.close),
                }
                : null,
              '1M': comp.charts[2]
                ? {
                  timestamps: comp.charts[2].quotes.map((q: any) =>
                    q.date.getTime(),
                  ),
                  prices: comp.charts[2].quotes.map((q: any) => q.close),
                }
                : null,
              '3M': comp.charts[3]
                ? {
                  timestamps: comp.charts[3].quotes.map((q: any) =>
                    q.date.getTime(),
                  ),
                  prices: comp.charts[3].quotes.map((q: any) => q.close),
                }
                : null,
              '6M': comp.charts[4]
                ? {
                  timestamps: comp.charts[4].quotes.map((q: any) =>
                    q.date.getTime(),
                  ),
                  prices: comp.charts[4].quotes.map((q: any) => q.close),
                }
                : null,
              '1Y': comp.charts[5]
                ? {
                  timestamps: comp.charts[5].quotes.map((q: any) =>
                    q.date.getTime(),
                  ),
                  prices: comp.charts[5].quotes.map((q: any) => q.close),
                }
                : null,
              MAX: comp.charts[6]
                ? {
                  timestamps: comp.charts[6].quotes.map((q: any) =>
                    q.date.getTime(),
                  ),
                  prices: comp.charts[6].quotes.map((q: any) => q.close),
                }
                : null,
            },
          }))
          : null,
      };

      return {
        type: 'stock',
        llmContext: `Current price of ${stockData.shortName} (${stockData.symbol}) is ${stockData.regularMarketPrice} ${stockData.currency}. Other details: ${JSON.stringify({
          marketState: stockData.marketState,
          regularMarketChange: stockData.regularMarketChange,
          regularMarketChangePercent: stockData.regularMarketChangePercent,
          marketCap: stockData.marketCap,
          peRatio: stockData.trailingPE,
          dividendYield: stockData.dividendYield,
        })}`,
        data: stockData,
      };
    } catch (error: any) {
      return {
        type: 'stock',
        llmContext: 'Failed to fetch stock data.',
        data: {
          error: `Error fetching stock data: ${error.message || error}`,
          ticker: params.ticker,
        },
      };
    }
  },
};

export default stockWidget;
