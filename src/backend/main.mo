import Map "mo:core/Map";
import List "mo:core/List";
import Float "mo:core/Float";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import Nat "mo:core/Nat";
import Order "mo:core/Order";
import OutCall "http-outcalls/outcall";
import Iter "mo:core/Iter";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  public type Strategy = {
    #scalping;
    #swing;
    #trendFollowing;
  };

  public type TradingGoals = {
    dailyProfit : Float;
    monthlyProfit : Float;
  };

  public type TradingViewData = {
    indicator : Text;
    value : Text;
  };

  public type AdvancedRiskSettings = {
    maxDailyLoss : Float;
    maxConcurrentTrades : Nat;
  };

  public type UserProfile = {
    balance : Float;
    maxRiskPercent : Float;
    dailyProfitTarget : Float;
    telegramBotToken : Text;
    telegramChatId : Text;
    soundAlertsEnabled : Bool;
  };

  public type ExtendedProfile = {
    username : Text;
    balance : Float;
    riskPercentage : Float;
    strategies : [Strategy];
    tradingGoals : TradingGoals;
    tradingViewData : [TradingViewData];
    advancedRiskSettings : AdvancedRiskSettings;
    telegramBotToken : Text;
    telegramChatId : Text;
    soundAlertsEnabled : Bool;
  };

  let profiles = Map.empty<Principal, ExtendedProfile>();

  module ExtendedProfile {
    public func compare(p1 : ExtendedProfile, p2 : ExtendedProfile) : Order.Order {
      switch (Text.compare(p1.username, p2.username)) {
        case (#equal) { Text.compare(p1.telegramChatId, p2.telegramChatId) };
        case (order) { order };
      };
    };

    public func compareByBalance(p1 : ExtendedProfile, p2 : ExtendedProfile) : Order.Order {
      Float.compare(p1.balance, p2.balance);
    };
  };

  let supportedSymbols = List.fromArray(["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"]);

  public type Candle = {
    symbol : Text;
    open : Float;
    high : Float;
    low : Float;
    close : Float;
    volume : Float;
    timestamp : Int;
  };

  let candles = Map.empty<Text, List.List<Candle>>();

  public type IndicatorResults = {
    rsi : Float;
    ema20 : Float;
    ema50 : Float;
    bollingerBands : (Float, Float, Float);
    macd : (Float, Float, Float);
    volumeTrend : Float;
    supportLevels : [Float];
    resistanceLevels : [Float];
  };

  public type Signal = {
    direction : { #buy; #sell; #hold };
    entryPrice : Float;
    stopLoss : Float;
    takeProfit : Float;
    lotSize : Float;
    rrRatio : Float;
    probability : Nat;
  };

  public type Trade = {
    symbol : Text;
    direction : { #buy; #sell };
    entry : Float;
    sl : Float;
    tp : Float;
    lotSize : Float;
    rrRatio : Float;
    probability : Nat;
    outcome : { #win; #loss; #pending };
    pnl : Float;
    timestamp : Int;
  };

  public type RiskCalculationParams = {
    accountBalance : Float;
    riskPercent : Float;
    entryPrice : Float;
    stopLoss : Float;
    positionType : { #market; #limit };
    leverage : Float;
  };

  public type RiskCalculationResult = {
    lotSize : Float;
    maxLotSize : Float;
    minLotSize : Float;
    marginRequirement : Float;
  };

  public type RiskLimits = {
    maxDailyDrawdown : Float;
    maxDailyTrades : Nat;
  };

  let pairs = Map.empty<Text, { symbol : Text; type_ : { #crypto; #forex } }>();

  func initializeDefaultSymbols() : () {
    let defaultPairs = [
      ("BTCUSDT", { symbol = "BTCUSDT"; type_ = #crypto }),
      ("ETHUSDT", { symbol = "ETHUSDT"; type_ = #crypto }),
      ("BNBUSDT", { symbol = "BNBUSDT"; type_ = #crypto }),
      ("SOLUSDT", { symbol = "SOLUSDT"; type_ = #crypto }),
      ("XRPUSDT", { symbol = "XRPUSDT"; type_ = #crypto }),
      ("EURUSD", { symbol = "EURUSD"; type_ = #forex }),
      ("GBPUSD", { symbol = "GBPUSD"; type_ = #forex }),
      ("USDJPY", { symbol = "USDJPY"; type_ = #forex }),
    ];

    for ((symbol, data) in defaultPairs.values()) {
      pairs.add(symbol, data);
    };
  };

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  func addOrUpdateCandlesInternal(symbol : Text, newCandles : [Candle]) : () {
    let existingCandles = switch (candles.get(symbol)) {
      case (null) { List.empty<Candle>() };
      case (?candles) { candles };
    };

    for (candle in newCandles.values()) {
      existingCandles.add(candle);
    };

    candles.add(symbol, existingCandles);
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };

    switch (profiles.get(caller)) {
      case (null) { null };
      case (?extProfile) {
        ?{
          balance = extProfile.balance;
          maxRiskPercent = extProfile.riskPercentage;
          dailyProfitTarget = extProfile.tradingGoals.dailyProfit;
          telegramBotToken = extProfile.telegramBotToken;
          telegramChatId = extProfile.telegramChatId;
          soundAlertsEnabled = extProfile.soundAlertsEnabled;
        };
      };
    };
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };

    let extProfile : ExtendedProfile = {
      username = caller.toText();
      balance = profile.balance;
      riskPercentage = profile.maxRiskPercent;
      strategies = [];
      tradingGoals = {
        dailyProfit = profile.dailyProfitTarget;
        monthlyProfit = 0.0;
      };
      tradingViewData = [];
      advancedRiskSettings = {
        maxDailyLoss = 0.0;
        maxConcurrentTrades = 0;
      };
      telegramBotToken = profile.telegramBotToken;
      telegramChatId = profile.telegramChatId;
      soundAlertsEnabled = profile.soundAlertsEnabled;
    };

    profiles.add(caller, extProfile);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };

    switch (profiles.get(user)) {
      case (null) { null };
      case (?extProfile) {
        ?{
          balance = extProfile.balance;
          maxRiskPercent = extProfile.riskPercentage;
          dailyProfitTarget = extProfile.tradingGoals.dailyProfit;
          telegramBotToken = extProfile.telegramBotToken;
          telegramChatId = extProfile.telegramChatId;
          soundAlertsEnabled = extProfile.soundAlertsEnabled;
        };
      };
    };
  };

  public shared ({ caller }) func saveProfile(profile : ExtendedProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    profiles.add(caller, profile);
  };

  public query ({ caller }) func getProfile() : async ?ExtendedProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    profiles.get(caller);
  };

  public shared ({ caller }) func receiveMT5Candles(symbol : Text, newCandles : [Candle]) : async () {
    addOrUpdateCandlesInternal(symbol, newCandles);
  };

  public shared ({ caller }) func addOrUpdateCandles(symbol : Text, newCandles : [Candle]) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can manually add candles");
    };
    addOrUpdateCandlesInternal(symbol, newCandles);
  };

  public query ({ caller }) func getCandles(symbol : Text, limit : Nat) : async [Candle] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view candles");
    };

    switch (candles.get(symbol)) {
      case (null) { [] };
      case (?list) {
        if (limit == 0) { list.toArray() } else {
          list.values().take(limit).toArray();
        };
      };
    };
  };

  public shared ({ caller }) func addPair(symbol : Text, type_ : { #crypto; #forex }) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can add pairs");
    };
    pairs.add(symbol, { symbol; type_ });
  };

  public shared ({ caller }) func removePair(symbol : Text) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can remove pairs");
    };
    pairs.remove(symbol);
  };

  public query ({ caller }) func getPairs() : async [(Text, { symbol : Text; type_ : { #crypto; #forex } })] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view pairs");
    };
    pairs.toArray();
  };

  public shared query ({ caller }) func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  public shared ({ caller }) func fetchBinanceData(symbol : Text, interval : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can fetch market data");
    };
    let url = "https://api.binance.com/api/v3/klines?symbol=" # symbol # "&interval=" # interval;
    await OutCall.httpGetRequest(url, [], transform);
  };

  public shared ({ caller }) func fetchNewsData(currencies : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can fetch news data");
    };
    let url = "https://cryptopanic.com/api/free/v1/posts/?public=true&currencies=" # currencies;
    await OutCall.httpGetRequest(url, [], transform);
  };

  public query ({ caller }) func getLatestTradeEntries() : async [(Text, ?Trade)] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view trade entries");
    };

    let trades = Map.empty<Text, List.List<Trade>>();
    let latestTrades = List.empty<(Text, ?Trade)>();

    for ((symbol, _) in pairs.entries()) {
      let tradeList = switch (trades.get(symbol)) {
        case (null) { List.empty<Trade>() };
        case (?list) { list };
      };

      let latestTrade = switch (tradeList.size()) {
        case (0) { null };
        case (_) { ?tradeList.at(tradeList.size() - 1) };
      };

      latestTrades.add((symbol, latestTrade));
    };

    latestTrades.toArray();
  };

  initializeDefaultSymbols();
};

