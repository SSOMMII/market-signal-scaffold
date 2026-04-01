from pykrx import stock
codes = ['051910', '018260', '009150', '066570', '032640', '005935', '000270']
for c in codes:
    name = stock.get_market_ticker_name(c)
    print(f'{c} -> {repr(name)}')
