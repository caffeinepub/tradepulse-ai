import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface TradingGoals {
    monthlyProfit: number;
    dailyProfit: number;
}
export interface AdvancedRiskSettings {
    maxConcurrentTrades: bigint;
    maxDailyLoss: number;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface Trade {
    sl: number;
    tp: number;
    pnl: number;
    probability: bigint;
    direction: Variant_buy_sell;
    entry: number;
    rrRatio: number;
    timestamp: bigint;
    outcome: Variant_win_pending_loss;
    lotSize: number;
    symbol: string;
}
export interface Candle {
    low: number;
    high: number;
    close: number;
    open: number;
    volume: number;
    timestamp: bigint;
    symbol: string;
}
export interface ExtendedProfile {
    telegramBotToken: string;
    tradingViewData: Array<TradingViewData>;
    tradingGoals: TradingGoals;
    username: string;
    balance: number;
    riskPercentage: number;
    soundAlertsEnabled: boolean;
    telegramChatId: string;
    advancedRiskSettings: AdvancedRiskSettings;
    strategies: Array<Strategy>;
}
export interface TradingViewData {
    value: string;
    indicator: string;
}
export interface UserProfile {
    telegramBotToken: string;
    balance: number;
    dailyProfitTarget: number;
    maxRiskPercent: number;
    soundAlertsEnabled: boolean;
    telegramChatId: string;
}
export interface http_header {
    value: string;
    name: string;
}
export enum Strategy {
    scalping = "scalping",
    trendFollowing = "trendFollowing",
    swing = "swing"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum Variant_buy_sell {
    buy = "buy",
    sell = "sell"
}
export enum Variant_forex_crypto {
    forex = "forex",
    crypto = "crypto"
}
export enum Variant_win_pending_loss {
    win = "win",
    pending = "pending",
    loss = "loss"
}
export interface backendInterface {
    addOrUpdateCandles(symbol: string, newCandles: Array<Candle>): Promise<void>;
    addPair(symbol: string, type: Variant_forex_crypto): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    fetchBinanceData(symbol: string, interval: string): Promise<string>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCandles(symbol: string, limit: bigint): Promise<Array<Candle>>;
    getLatestTradeEntries(): Promise<Array<[string, Trade | null]>>;
    getPairs(): Promise<Array<[string, {
            type: Variant_forex_crypto;
            symbol: string;
        }]>>;
    getProfile(): Promise<ExtendedProfile | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    receiveMT5Candles(symbol: string, newCandles: Array<Candle>): Promise<void>;
    removePair(symbol: string): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    saveProfile(profile: ExtendedProfile): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
}
