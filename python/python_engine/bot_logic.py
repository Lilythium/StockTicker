import random

# ==== Helper Functions ====

def roundToNearestIncrement(shares, allowedIncrements=[500, 1000, 2000, 5000]):
    """Round share count to nearest allowed increment"""
    if shares <= 0:
        return 0
    
    # Find best increment that fits
    for increment in sorted(allowedIncrements, reverse=True):
        if shares >= increment:
            return (shares // increment) * increment
    
    # If less than smallest increment, return smallest if close enough
    return allowedIncrements[0] if shares >= allowedIncrements[0] // 2 else 0


def calculatePortfolioValue(cash, portfolio, stocks):
    """Calculate total portfolio value in cents"""
    stockValue = 0
    for stockName, shares in portfolio.items():
        stockValue += shares * stocks[stockName]
    return cash + stockValue


def getTradeSize(dollarAmountCents, priceCents, allowedIncrements=[500, 1000, 2000, 5000]):
    """Get trade size rounded to allowed increments"""
    if priceCents == 0:
        return 0
    targetShares = dollarAmountCents / priceCents
    return roundToNearestIncrement(int(targetShares), allowedIncrements)


def canAfford(cash, stock, amount, stocks):
    """Check if we can afford a purchase"""
    cost = amount * stocks[stock]
    return cost <= cash


# ==== Strategy 1: Balanced Value Investor ====

def balancedValueBot(cash, portfolio, stocks):
    """
    Conservative diversification with price-based valuation
    Maintains 10% cash reserve, owns all stocks, frequent small rebalancing
    """
    portfolioValue = calculatePortfolioValue(cash, portfolio, stocks)
    
    # Target allocations based on price brackets
    targetPercents = {}
    for stockName, price in stocks.items():
        if price < 100:  # < $1.00 - risky
            targetPercents[stockName] = 0.05
        elif price < 150:  # $1.00-$1.49 - stable
            targetPercents[stockName] = 0.20
        elif price < 190:  # $1.50-$1.89 - growth
            targetPercents[stockName] = 0.25
        else:  # $1.90+ - near split
            targetPercents[stockName] = 0.15
    
    # Normalize to 90% invested, 10% cash
    totalStockTarget = sum(targetPercents.values())
    if totalStockTarget > 0:
        for stockName in targetPercents:
            targetPercents[stockName] = (targetPercents[stockName] / totalStockTarget) * 0.90
    
    # Generate rebalancing trades
    trades = []
    for stockName, price in stocks.items():
        targetValue = int(targetPercents[stockName] * portfolioValue)
        currentShares = portfolio.get(stockName, 0)
        currentValue = currentShares * price
        valueDiff = targetValue - currentValue
        
        # Small threshold to avoid overtrading
        if abs(valueDiff) < portfolioValue * 0.02:  # Less than 2% difference
            continue
        
        if valueDiff > 0:  # Buy
            sharesToBuy = getTradeSize(valueDiff, price)
            if sharesToBuy > 0 and canAfford(cash, stockName, sharesToBuy, stocks):
                trades.append((stockName, 'buy', sharesToBuy))
                cash -= sharesToBuy * price
        elif valueDiff < 0:  # Sell
            sharesToSell = getTradeSize(-valueDiff, price)
            sharesToSell = min(sharesToSell, currentShares)
            if sharesToSell > 0:
                trades.append((stockName, 'sell', sharesToSell))
                cash += sharesToSell * price
    
    random.shuffle(trades)
    return trades


# ==== Strategy 2: Dividend Momentum Trader ====

def dividendMomentumBot(cash, portfolio, stocks):
    """
    Aggressive momentum chaser - concentrates in winners above $1.00
    Low cash reserves (0-5%), stop-loss at $0.80, split anticipation
    """
    portfolioValue = calculatePortfolioValue(cash, portfolio, stocks)
    
    # Score each stock (higher = more attractive)
    scores = {}
    for stockName, price in stocks.items():
        score = 0
        
        # DIVIDEND ELIGIBILITY (huge bonus)
        if price >= 100:
            score += 50
        
        # MOMENTUM ZONES
        if price >= 160 and price < 190:  # Split zone
            score += 40
        elif price >= 120 and price < 160:  # Growth zone
            score += 30
        elif price >= 100 and price < 120:  # Stable dividend zone
            score += 20
        
        # PENALTY ZONES
        if price < 80:  # Stop-loss trigger
            score = -100
        elif price < 100:  # Below dividend threshold
            score -= 20
        
        if price >= 190:  # Too close to split
            score -= 10
        
        scores[stockName] = score
    
    # Sort stocks by score
    rankedStocks = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    
    trades = []
    
    # STEP 1: STOP-LOSS - Dump anything below $0.80 immediately
    for stockName, score in rankedStocks:
        if stocks[stockName] < 80:
            currentShares = portfolio.get(stockName, 0)
            if currentShares > 0:
                trades.append((stockName, 'sell', currentShares))
                cash += currentShares * stocks[stockName]
    
    # STEP 2: CONCENTRATE IN TOP 2-3 STOCKS
    targetStocks = [s for s, score in rankedStocks[:3] if score > 0]
    
    if targetStocks:
        # Allocate 95% of portfolio value to top picks
        investmentCash = int(portfolioValue * 0.95)
        perStockTarget = investmentCash // len(targetStocks)
        
        for stockName in targetStocks:
            currentShares = portfolio.get(stockName, 0)
            currentValue = currentShares * stocks[stockName]
            valueDiff = perStockTarget - currentValue
            
            if valueDiff > 1000:  # Significant buy
                sharesToBuy = getTradeSize(valueDiff, stocks[stockName])
                if sharesToBuy > 0 and canAfford(cash, stockName, sharesToBuy, stocks):
                    trades.append((stockName, 'buy', sharesToBuy))
                    cash -= sharesToBuy * stocks[stockName]
        
        # STEP 3: SELL NON-TOP HOLDINGS (except tiny positions)
        for stockName, currentShares in portfolio.items():
            if stockName not in targetStocks and currentShares > 0:
                value = currentShares * stocks[stockName]
                if value > portfolioValue * 0.05:  # More than 5% of portfolio
                    trades.append((stockName, 'sell', currentShares))
    
    random.shuffle(trades)
    return trades


# ==== Strategy 3: Contrarian Mean Reversion ====

def contrarianMeanReversionBot(cash, portfolio, stocks):
    """
    Buy the panic, sell the euphoria - contrarian mean reversion
    Bottom fishing, anti-momentum, sells before splits
    """
    portfolioValue = calculatePortfolioValue(cash, portfolio, stocks)
    meanPrice = sum(stocks.values()) // len(stocks)  # Average price
    
    # Calculate deviation from mean
    deviations = {}
    for stockName, price in stocks.items():
        deviation = (price - meanPrice) / meanPrice if meanPrice > 0 else 0
        deviations[stockName] = deviation
    
    trades = []
    
    for stockName, price in stocks.items():
        currentShares = portfolio.get(stockName, 0)
        deviation = deviations[stockName]
        
        # EXTREME CONTRARIAN ZONES
        if price < 50:  # Below $0.50 - MAXIMUM BOTTOM FISHING
            # Bet big on bankruptcy survivors
            targetValue = int(portfolioValue * 0.25)
            currentValue = currentShares * price
            if currentValue < targetValue:
                sharesToBuy = getTradeSize(targetValue - currentValue, price)
                if sharesToBuy > 0 and canAfford(cash, stockName, sharesToBuy, stocks):
                    trades.append((stockName, 'buy', sharesToBuy))
                    cash -= sharesToBuy * price
        
        elif price >= 50 and price < 100:  # $0.50-$1.00 - STRONG BUY
            targetValue = int(portfolioValue * 0.20)
            currentValue = currentShares * price
            if currentValue < targetValue:
                sharesToBuy = getTradeSize(targetValue - currentValue, price)
                if sharesToBuy > 0 and canAfford(cash, stockName, sharesToBuy, stocks):
                    trades.append((stockName, 'buy', sharesToBuy))
                    cash -= sharesToBuy * price
        
        elif price >= 150:  # Above $1.50 - TAKE PROFITS
            # Sell 50-100% of position depending on price
            if price >= 180:  # Near split - SELL EVERYTHING
                if currentShares > 0:
                    trades.append((stockName, 'sell', currentShares))
                    cash += currentShares * price
            elif price >= 150:  # Moderate profit taking
                sellAmount = int(currentShares * 0.5)
                sellAmount = roundToNearestIncrement(sellAmount)
                if sellAmount > 0:
                    trades.append((stockName, 'sell', sellAmount))
                    cash += sellAmount * price
        
        # MEAN REVERSION TRADES
        elif deviation > 0.3:  # Much higher than average - SELL
            currentValue = currentShares * price
            if currentValue > portfolioValue * 0.10:
                targetValue = int(portfolioValue * 0.05)
                sellValue = currentValue - targetValue
                sharesToSell = getTradeSize(sellValue, price)
                sharesToSell = min(sharesToSell, currentShares)
                if sharesToSell > 0:
                    trades.append((stockName, 'sell', sharesToSell))
        
        elif deviation < -0.3:  # Much lower than average - BUY
            targetValue = int(portfolioValue * 0.15)
            currentValue = currentShares * price
            if currentValue < targetValue:
                sharesToBuy = getTradeSize(targetValue - currentValue, price)
                if sharesToBuy > 0 and canAfford(cash, stockName, sharesToBuy, stocks):
                    trades.append((stockName, 'buy', sharesToBuy))
    
    random.shuffle(trades)
    return trades


# ==== Strategy 4: Dividend Farmer ====

def dividendFarmerBot(cash, portfolio, stocks):
    """
    Ultra-conservative dividend harvester
    Only holds dividend-eligible stocks, maximizes share COUNT for dividend income
    Prefers stable $1.30-$1.60 range, exits below $1.00
    """
    portfolioValue = calculatePortfolioValue(cash, portfolio, stocks)
    
    # Classify stocks
    dividendStocks = []  # Above $1.00
    exitStocks = []      # Below $1.00 - must sell
    idealStocks = []     # $1.30-$1.60 - sweet spot
    
    for stockName, price in stocks.items():
        if price < 100:  # Below dividend threshold
            if portfolio.get(stockName, 0) > 0:
                exitStocks.append(stockName)
        elif price >= 130 and price < 160:  # Ideal dividend range
            idealStocks.append(stockName)
            dividendStocks.append(stockName)
        elif price >= 100 and price < 180:  # Acceptable but not ideal
            dividendStocks.append(stockName)
        # Above $1.80 = too risky (near split), don't hold
    
    trades = []
    
    # STEP 1: EXIT anything below $1.00 immediately
    for stockName in exitStocks:
        currentShares = portfolio.get(stockName, 0)
        if currentShares > 0:
            trades.append((stockName, 'sell', currentShares))
            cash += currentShares * stocks[stockName]
    
    # STEP 2: EXIT anything above $1.80 (split risk)
    for stockName, price in stocks.items():
        if price >= 180:
            currentShares = portfolio.get(stockName, 0)
            if currentShares > 0:
                trades.append((stockName, 'sell', currentShares))
                cash += currentShares * stocks[stockName]
    
    # STEP 3: Build equal SHARE COUNT across all dividend stocks
    if dividendStocks:
        # Target: Equal number of shares in each dividend stock
        # Priority to ideal range stocks
        targetStocks = idealStocks if idealStocks else dividendStocks
        
        # Calculate target share count (not value!)
        # Aim for 80% invested, distributed by share count
        investmentCash = int(portfolioValue * 0.80)
        
        # Calculate current total shares across dividend stocks
        currentTotalShares = sum(portfolio.get(s, 0) for s in targetStocks)
        
        # Calculate average price of target stocks
        avgPrice = sum(stocks[s] for s in targetStocks) // len(targetStocks)
        
        # Target shares per stock to maximize dividend potential
        targetSharesPerStock = (investmentCash // len(targetStocks)) // avgPrice
        targetSharesPerStock = roundToNearestIncrement(targetSharesPerStock)
        
        for stockName in targetStocks:
            currentShares = portfolio.get(stockName, 0)
            shareDiff = targetSharesPerStock - currentShares
            
            if shareDiff > 500:  # Need more shares
                sharesToBuy = roundToNearestIncrement(shareDiff)
                if sharesToBuy > 0 and canAfford(cash, stockName, sharesToBuy, stocks):
                    trades.append((stockName, 'buy', sharesToBuy))
                    cash -= sharesToBuy * stocks[stockName]
            elif shareDiff < -500:  # Have too many shares
                sharesToSell = roundToNearestIncrement(-shareDiff)
                sharesToSell = min(sharesToSell, currentShares)
                if sharesToSell > 0:
                    trades.append((stockName, 'sell', sharesToSell))
                    cash += sharesToSell * stocks[stockName]
        
        # Sell holdings not in target list (non-ideal dividend stocks)
        for stockName, currentShares in portfolio.items():
            if stockName not in targetStocks and currentShares > 0:
                if stocks[stockName] >= 100:  # Still dividend-eligible but not ideal
                    # Only sell if it would free up significant cash
                    value = currentShares * stocks[stockName]
                    if value > portfolioValue * 0.10:
                        trades.append((stockName, 'sell', currentShares))
    
    random.shuffle(trades)
    return trades


# ==== Strategy 5: Chaos Gambler ====

def chaosGamblerBot(cash, portfolio, stocks, round_num=1):
    """
    Unpredictable wildcard - makes seemingly random decisions
    Uses "superstitions" and random obsessions each round
    Disrupts predictable patterns and keeps other bots guessing
    """
    portfolioValue = calculatePortfolioValue(cash, portfolio, stocks)
    trades = []
    
    # Generate "mood" based on round number (changes behavior)
    mood = round_num % 5
    
    # Random obsession: Pick a random stock to go all-in on
    obsessionStock = random.choice(list(stocks.keys()))
    
    if mood == 0:  # "YOLO MODE" - All-in on random stock
        # Liquidate everything else
        for stockName, currentShares in portfolio.items():
            if stockName != obsessionStock and currentShares > 0:
                trades.append((stockName, 'sell', currentShares))
                cash += currentShares * stocks[stockName]
        
        # Buy as much of obsession stock as possible
        if cash > 1000:
            sharesToBuy = getTradeSize(int(cash * 0.95), stocks[obsessionStock])
            if sharesToBuy > 0:
                trades.append((obsessionStock, 'buy', sharesToBuy))
    
    elif mood == 1:  # "ALPHABET MODE" - Favor stocks by alphabetical order
        # Favor first 3 alphabetically
        sortedStocks = sorted(stocks.keys())
        favoredStocks = sortedStocks[:3]
        
        # Sell unfavored
        for stockName in sortedStocks[3:]:
            currentShares = portfolio.get(stockName, 0)
            if currentShares > 0:
                trades.append((stockName, 'sell', currentShares))
                cash += currentShares * stocks[stockName]
        
        # Buy favored
        investmentPer = int(portfolioValue * 0.30)
        for stockName in favoredStocks:
            sharesToBuy = getTradeSize(investmentPer, stocks[stockName])
            if sharesToBuy > 0 and canAfford(cash, stockName, sharesToBuy, stocks):
                trades.append((stockName, 'buy', sharesToBuy))
                cash -= sharesToBuy * stocks[stockName]
    
    elif mood == 2:  # "PRICE SUPERSTITION" - Only buy stocks with prices ending in 5 or 0
        luckyStocks = [s for s, p in stocks.items() if (p % 10 == 5 or p % 10 == 0)]
        
        # Sell unlucky stocks
        for stockName, currentShares in portfolio.items():
            if stockName not in luckyStocks and currentShares > 0:
                trades.append((stockName, 'sell', currentShares))
                cash += currentShares * stocks[stockName]
        
        # Buy lucky stocks
        if luckyStocks:
            investmentPer = int(portfolioValue * 0.25)
            for stockName in luckyStocks:
                sharesToBuy = getTradeSize(investmentPer, stocks[stockName])
                if sharesToBuy > 0 and canAfford(cash, stockName, sharesToBuy, stocks):
                    trades.append((stockName, 'buy', sharesToBuy))
                    cash -= sharesToBuy * stocks[stockName]
    
    elif mood == 3:  # "EXTREMIST MODE" - Only buy cheapest OR most expensive
        cheapest = min(stocks.items(), key=lambda x: x[1])[0]
        mostExpensive = max(stocks.items(), key=lambda x: x[1])[0]
        extremeStocks = [cheapest, mostExpensive]
        
        # Sell everything else
        for stockName, currentShares in portfolio.items():
            if stockName not in extremeStocks and currentShares > 0:
                trades.append((stockName, 'sell', currentShares))
                cash += currentShares * stocks[stockName]
        
        # Buy extremes
        investmentPer = int(portfolioValue * 0.45)
        for stockName in extremeStocks:
            sharesToBuy = getTradeSize(investmentPer, stocks[stockName])
            if sharesToBuy > 0 and canAfford(cash, stockName, sharesToBuy, stocks):
                trades.append((stockName, 'buy', sharesToBuy))
                cash -= sharesToBuy * stocks[stockName]
    
    else:  # mood == 4: "SCATTER MODE" - Buy random amounts of everything
        for stockName in stocks.keys():
            # Random investment between 5-25% of portfolio
            investmentPercent = random.uniform(0.05, 0.25)
            targetValue = int(portfolioValue * investmentPercent)
            currentValue = portfolio.get(stockName, 0) * stocks[stockName]
            valueDiff = targetValue - currentValue
            
            if valueDiff > 1000:
                sharesToBuy = getTradeSize(valueDiff, stocks[stockName])
                if sharesToBuy > 0 and canAfford(cash, stockName, sharesToBuy, stocks):
                    trades.append((stockName, 'buy', sharesToBuy))
                    cash -= sharesToBuy * stocks[stockName]
            elif valueDiff < -1000:
                sharesToSell = getTradeSize(-valueDiff, stocks[stockName])
                currentShares = portfolio.get(stockName, 0)
                sharesToSell = min(sharesToSell, currentShares)
                if sharesToSell > 0:
                    trades.append((stockName, 'sell', sharesToSell))
                    cash += sharesToSell * stocks[stockName]
    
    # Extra chaos: Sometimes make completely random trade
    if random.random() < 0.3:  # 30% chance
        randomStock = random.choice(list(stocks.keys()))
        randomAction = random.choice(['buy', 'sell'])
        randomAmount = random.choice([500, 1000, 2000])
        
        if randomAction == 'buy' and canAfford(cash, randomStock, randomAmount, stocks):
            trades.append((randomStock, 'buy', randomAmount))
        elif randomAction == 'sell':
            currentShares = portfolio.get(randomStock, 0)
            if currentShares >= randomAmount:
                trades.append((randomStock, 'sell', randomAmount))
    
    random.shuffle(trades)
    return trades


# ==== Bot Selector ====

BOTS = {
    'balanced': balancedValueBot,
    'momentum': dividendMomentumBot,
    'contrarian': contrarianMeanReversionBot,
    'farmer': dividendFarmerBot,
    'chaos': chaosGamblerBot
}

BOT_NAMES = {
    'balanced': [
        "Buffett",      # Warren Buffett
        "Bogle",        # John Bogle (Vanguard)
        "Munger",       # Charlie Munger
        "Graham",       # Benjamin Graham
        "Templeton",    # John Templeton
        "Klarman",      # Seth Klarman
        "Lynch",        # Peter Lynch
        "Fisher",       # Philip Fisher
        "Dalio",        # Ray Dalio
        "Miller"        # Bill Miller
    ],
    'momentum': [
        "Cramer",       # Jim Cramer (Mad Money)
        "RoaringKitty", # Keith Gill (GME saga)
        "Magnetar",     # Quant hedge fund
        "Renaissance",  # Renaissance Technologies
        "Citadel",      # Citadel Securities
        "Tiger",        # Tiger Management
        "Pelosi"        # Nancy Pelosi (famous for stock picks)
    ],
    'contrarian': [
        "Burry",        # Michael Burry (The Big Short)
        "Soros",        # George Soros
        "Icahn",        # Carl Icahn
        "Druckenmiller",# Stanley Druckenmiller
        "Ackman",       # Bill Ackman
        "Loeb",         # Dan Loeb
        "Einhorn",      # David Einhorn
        "Chan",         # Michael Chan
        "Zell",         # Sam Zell
        "Spitznagel"    # Mark Spitznagel
    ],
    'farmer': [
        "DividendKing", # Long-term dividend focus
        "YieldMax",     # Yield maximizer
        "DRIP",         # Dividend Reinvestment Plan
        "Payout",       # Focus on payouts
        "Annuity",      # Steady income
        "Coupon",       # Bond coupon focus
        "HighYield",    # High yield seeker
    ],
    'chaos': [
        "Monkey",       # Monkey throwing darts
        "Degen",        # Degenerate gambler
        "WallStreetBets",
        "ThetaGang",    # Selling options
        "Roulette",     # Casino style
        "Lottery",      # Lottery tickets
    ]
}

def getBotName(strategy_name):
    """Get a random bot name for the given strategy"""
    if strategy_name in BOT_NAMES:
        return random.choice(BOT_NAMES[strategy_name])
    return "Mystery Bot"
